import type {
  CacheEntry,
  FailureRecord,
  NewTicket,
  TicketRow,
} from "../types.js";

export interface Store {
  init(): Promise<void>;
  createTicket(t: NewTicket): Promise<{ id: number }>;
  listTickets(limit?: number): Promise<TicketRow[]>;
  getCache(key: string): Promise<CacheEntry | null>;
  setCache(key: string, response: Record<string, unknown>, source: string): Promise<void>;
  cacheStats(): Promise<{ entries: number; hits: number }>;
  recordError(failure: FailureRecord): Promise<void>;
  listErrors(limit?: number): Promise<FailureRecord[]>;
  close(): Promise<void>;
}
