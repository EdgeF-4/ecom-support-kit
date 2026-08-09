import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface Config {
  service: { host: string; port: number };
  store: { driver: "memory" | "postgres"; postgres: PostgresConfig };
  llm: {
    driver: "mock" | "openaiCompatible";
    openaiCompatible: {
      baseUrl: string;
      apiKey: string;
      model: string;
      maxTokens: number;
    };
  };
  cache: { enabled: boolean; ttlSeconds: number };
  escalation: { queue: string; notifyEmail: string };
  dataDir: string;
}

const here = path.dirname(fileURLToPath(import.meta.url)); // dist/src
const pkgRoot = path.resolve(here, "..", ".."); // service root

function defaults(): Config {
  return {
    service: { host: "127.0.0.1", port: 8080 },
    store: {
      driver: "memory",
      postgres: {
        host: "localhost",
        port: 5432,
        database: "support",
        user: "support",
        password: "",
      },
    },
    llm: {
      driver: "mock",
      openaiCompatible: {
        baseUrl: "https://api.your-provider.example/v1",
        apiKey: "",
        model: "your-model-name",
        maxTokens: 400,
      },
    },
    cache: { enabled: true, ttlSeconds: 86400 },
    escalation: { queue: "support-tier-1", notifyEmail: "support@example.com" },
    dataDir: process.env.DATA_DIR || path.join(pkgRoot, "data"),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isObject(override)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

function fromFile(): unknown {
  const candidate =
    process.env.SUPPORT_CONFIG || path.join(pkgRoot, "..", "config.json");
  if (existsSync(candidate)) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8"));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function fromEnv(cfg: Config): Config {
  const out = { ...cfg };
  if (process.env.SUPPORT_HOST) out.service.host = process.env.SUPPORT_HOST;
  if (process.env.PORT) out.service.port = Number(process.env.PORT);
  if (process.env.STORE_DRIVER)
    out.store.driver = process.env.STORE_DRIVER as Config["store"]["driver"];
  if (process.env.LLM_DRIVER)
    out.llm.driver = process.env.LLM_DRIVER as Config["llm"]["driver"];
  const pg = out.store.postgres;
  if (process.env.PGHOST) pg.host = process.env.PGHOST;
  if (process.env.PGPORT) pg.port = Number(process.env.PGPORT);
  if (process.env.PGDATABASE) pg.database = process.env.PGDATABASE;
  if (process.env.PGUSER) pg.user = process.env.PGUSER;
  if (process.env.PGPASSWORD) pg.password = process.env.PGPASSWORD;
  return out;
}

/**
 * Resolve runtime config. Order of precedence, low to high:
 * built in defaults, config.json, environment variables. The defaults run the
 * kit fully offline with a mock store and a mock model, so no secret is needed.
 */
export function loadConfig(): Config {
  const merged = deepMerge(defaults(), fromFile());
  return fromEnv(merged);
}
