import type { Config } from "../config.js";
import { createMemoryStore } from "./memory.js";
import type { Store } from "./types.js";

export type { Store } from "./types.js";
export { createMemoryStore } from "./memory.js";

/**
 * Build the configured store. Postgres is loaded lazily so the memory store
 * (used by tests and the offline demo) never needs the pg driver at runtime.
 */
export async function createStore(config: Config): Promise<Store> {
  if (config.store.driver === "postgres") {
    const { createPostgresStore } = await import("./postgres.js");
    return createPostgresStore(config.store.postgres);
  }
  return createMemoryStore();
}
