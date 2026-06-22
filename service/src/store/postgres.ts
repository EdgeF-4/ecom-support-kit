import pg from "pg";
import type { PostgresConfig } from "../config.js";
import type {
  CacheEntry,
  FailureRecord,
  NewTicket,
  TicketRow,
} from "../types.js";
import type { Store } from "./types.js";

const { Pool } = pg;

const DDL = `
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'web',
  customer_email TEXT,
  message TEXT NOT NULL,
  intent TEXT,
  route TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assignee TEXT,
  reply TEXT,
  confidence REAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS answer_cache (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  source TEXT NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS failures (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  workflow TEXT,
  node TEXT,
  error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
`;

export function createPostgresStore(cfg: PostgresConfig): Store {
  const pool = new Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: 5,
  });

  return {
    async init() {
      await pool.query(DDL);
    },
    async createTicket(t: NewTicket) {
      const res = await pool.query<{ id: number }>(
        `INSERT INTO tickets
           (channel, customer_email, message, intent, route, status, assignee, reply, confidence, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          t.channel,
          t.customerEmail,
          t.message,
          t.intent,
          t.route,
          t.status,
          t.assignee ?? null,
          t.reply,
          t.confidence,
          JSON.stringify(t.metadata ?? {}),
        ]
      );
      return { id: res.rows[0].id };
    },
    async listTickets(limit = 100) {
      const res = await pool.query<TicketRow>(
        `SELECT id, created_at AS "createdAt", channel,
                customer_email AS "customerEmail", message, intent, route,
                status, assignee, reply, confidence, metadata
         FROM tickets ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    },
    async getCache(key: string): Promise<CacheEntry | null> {
      const res = await pool.query(
        `UPDATE answer_cache
            SET hit_count = hit_count + 1, last_hit_at = now()
          WHERE key = $1
          RETURNING response, source, hit_count`,
        [key]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0];
      return {
        response: row.response,
        source: row.source,
        hitCount: row.hit_count,
      };
    },
    async setCache(key, response, source) {
      await pool.query(
        `INSERT INTO answer_cache (key, response, source)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(response), source]
      );
    },
    async cacheStats() {
      const res = await pool.query(
        `SELECT count(*)::int AS entries,
                COALESCE(sum(hit_count), 0)::int AS hits
         FROM answer_cache`
      );
      return { entries: res.rows[0].entries, hits: res.rows[0].hits };
    },
    async recordError(failure: FailureRecord) {
      await pool.query(
        `INSERT INTO failures (workflow, node, error, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          failure.workflow ?? null,
          failure.node ?? null,
          failure.error ?? null,
          JSON.stringify(failure),
        ]
      );
    },
    async listErrors(limit = 100) {
      const res = await pool.query(
        `SELECT workflow, node, error, payload, created_at AS "at"
         FROM failures ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    },
    async close() {
      await pool.end();
    },
  };
}
