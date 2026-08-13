import { ActionableError } from "./errors.js";

interface ClosableServer {
  close(callback: (error?: Error) => void): void;
}

interface ClosableStore {
  close(): Promise<void>;
}

export async function closeRuntime(
  server: ClosableServer,
  store: ClosableStore
): Promise<ActionableError | null> {
  let failure: unknown;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }).catch((error) => {
    failure = error;
  });
  await store.close().catch((error) => {
    failure ??= error;
  });

  if (!failure) return null;
  return new ActionableError(
    "SHUTDOWN_FAILED",
    "The support service could not shut down cleanly.",
    "Confirm no requests are still running, check the store connection, then stop the process again.",
    { cause: failure }
  );
}
