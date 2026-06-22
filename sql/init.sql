-- Schema for the support kit. Loaded automatically by the Postgres container
-- on first start, and used by the tool service when store.driver = "postgres".

CREATE TABLE IF NOT EXISTS tickets (
    id             SERIAL PRIMARY KEY,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel        TEXT NOT NULL DEFAULT 'web',
    customer_email TEXT,
    message        TEXT NOT NULL,
    intent         TEXT,
    route          TEXT,
    status         TEXT NOT NULL DEFAULT 'open',
    assignee       TEXT,
    reply          TEXT,
    confidence     REAL,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tickets_status  ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets (created_at);

-- Answer cache for cost control. Repeated questions that would otherwise hit a
-- paid model are served from here instead.
CREATE TABLE IF NOT EXISTS answer_cache (
    key         TEXT PRIMARY KEY,
    response    JSONB NOT NULL,
    source      TEXT NOT NULL,
    hit_count   INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_hit_at TIMESTAMPTZ
);

-- Failures reported by the n8n error workflow: the failing node, the input,
-- and the error message for each failed execution.
CREATE TABLE IF NOT EXISTS failures (
    id         SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workflow   TEXT,
    node       TEXT,
    error      TEXT,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb
);
