export interface ProblemDetails {
  error: string;
  message: string;
  next: string;
}

export class ActionableError extends Error {
  readonly code: string;
  readonly next: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    next: string,
    options: { cause?: unknown; status?: number } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ActionableError";
    this.code = code;
    this.next = next;
    this.status = options.status ?? 500;
  }
}

export function asActionable(
  error: unknown,
  fallback: Omit<ProblemDetails, "error"> & { error: string; status?: number }
): ActionableError {
  if (error instanceof ActionableError) return error;
  return new ActionableError(
    fallback.error,
    fallback.message,
    fallback.next,
    { cause: error, status: fallback.status }
  );
}

export function toProblem(error: unknown): ProblemDetails & { status: number } {
  const problem = asActionable(error, {
    error: "INTERNAL_ERROR",
    message: "The support service could not complete the request.",
    next: "Check the service log for the matching error code, then retry the request.",
    status: 500,
  });
  return {
    error: problem.code,
    message: problem.message,
    next: problem.next,
    status: problem.status,
  };
}

export function formatActionable(error: unknown): string {
  const problem = toProblem(error);
  return `[${problem.error}] ${problem.message} Next: ${problem.next}`;
}

export function listenFailure(
  error: unknown,
  host: string,
  port: number
): ActionableError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "LISTEN_FAILED";

  let next: string;
  switch (code) {
    case "EADDRINUSE":
      next = `Stop the process using port ${port}, or choose an unused loopback port with PORT=${port + 1} npm start.`;
      break;
    case "EACCES":
      next = "Choose an unprivileged port such as PORT=8080, check local bind permissions, and retry npm start.";
      break;
    case "ENOTFOUND":
    case "EADDRNOTAVAIL":
    case "EAI_AGAIN":
    case "EAI_FAIL":
      next = "Set SERVICE_HOST=127.0.0.1, verify that the address exists locally, and retry npm start.";
      break;
    default:
      next = "Check SERVICE_HOST, PORT, and local socket permissions, then retry npm start.";
  }

  return new ActionableError(
    "LISTEN_FAILED",
    `Cannot listen on ${host}:${port} (${code}).`,
    next,
    { cause: error }
  );
}

export function runtimeServerFailure(error: unknown): ActionableError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "SERVER_ERROR";
  return new ActionableError(
    "SERVER_ERROR",
    `The HTTP server reported a runtime failure (${code}).`,
    "Check the service log and active client requests, restart npm start, then run npm run verify if it repeats.",
    { cause: error }
  );
}
