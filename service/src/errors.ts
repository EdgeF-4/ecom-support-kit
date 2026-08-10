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
