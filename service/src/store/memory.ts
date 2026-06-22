import type {
  CacheEntry,
  FailureRecord,
  NewTicket,
  TicketRow,
} from "../types.js";
import type { Store } from "./types.js";

/**
 * In memory store used for tests and for running the kit without Postgres.
 * It implements the same interface as the Postgres store, so the rest of the
 * code never knows which one is active.
 */
export function createMemoryStore(): Store {
  const tickets: TicketRow[] = [];
  const cache = new Map<string, CacheEntry & { createdAt: string }>();
  const errors: FailureRecord[] = [];
  let nextId = 1;

  return {
    async init() {
      /* nothing to set up */
    },
    async createTicket(t: NewTicket) {
      const row: TicketRow = {
        id: nextId++,
        createdAt: new Date().toISOString(),
        ...t,
        assignee: t.assignee ?? null,
        metadata: t.metadata ?? {},
      };
      tickets.push(row);
      return { id: row.id };
    },
    async listTickets(limit = 100) {
      return tickets.slice(-limit).reverse();
    },
    async getCache(key: string) {
      const hit = cache.get(key);
      if (!hit) return null;
      hit.hitCount += 1;
      return { response: hit.response, source: hit.source, hitCount: hit.hitCount };
    },
    async setCache(key, response, source) {
      if (cache.has(key)) return;
      cache.set(key, {
        response,
        source,
        hitCount: 0,
        createdAt: new Date().toISOString(),
      });
    },
    async cacheStats() {
      let hits = 0;
      for (const v of cache.values()) hits += v.hitCount;
      return { entries: cache.size, hits };
    },
    async recordError(failure: FailureRecord) {
      errors.push({ ...failure, at: new Date().toISOString() });
    },
    async listErrors(limit = 100) {
      return errors.slice(-limit).reverse();
    },
    async close() {
      /* nothing to tear down */
    },
  };
}
