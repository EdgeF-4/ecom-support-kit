import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import type { Store } from "./store/index.js";
import type { CacheEntry } from "./types.js";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Answer cache for cost control. The key is a hash of the normalized message
 * and the route, so a repeated question on the model route is served from the
 * store instead of triggering another paid model call.
 */
export function makeCache(store: Store, config: Config) {
  const enabled = config.cache.enabled;
  const key = (message: string, route: string) =>
    createHash("sha256")
      .update(normalize(message) + "|" + route)
      .digest("hex");

  return {
    enabled,
    key,
    async get(message: string, route: string): Promise<CacheEntry | null> {
      if (!enabled) return null;
      return store.getCache(key(message, route));
    },
    async set(
      message: string,
      route: string,
      response: Record<string, unknown>,
      source: string
    ): Promise<void> {
      if (!enabled) return;
      await store.setCache(key(message, route), response, source);
    },
  };
}

export type Cache = ReturnType<typeof makeCache>;
