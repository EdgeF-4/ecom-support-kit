import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ActionableError } from "./errors.js";

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
  llm: { driver: "mock" };
  cache: { enabled: boolean; ttlSeconds: number };
  escalation: { queue: string };
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
    llm: { driver: "mock" },
    cache: { enabled: true, ttlSeconds: 86400 },
    escalation: { queue: "support-tier-1" },
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
  const explicit = process.env.SUPPORT_CONFIG;
  const candidate = explicit || path.join(pkgRoot, "..", "config.json");
  if (explicit && !existsSync(candidate)) {
    throw new ActionableError(
      "CONFIG_FILE_MISSING",
      `Cannot find the configuration file at ${candidate}.`,
      "Fix SUPPORT_CONFIG, or unset it to use the offline defaults, then run npm run demo."
    );
  }
  if (existsSync(candidate)) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8"));
    } catch (error) {
      throw new ActionableError(
        "CONFIG_PARSE_FAILED",
        `Cannot parse the configuration file at ${candidate}.`,
        "Fix its JSON syntax, or remove it to use the offline defaults, then run npm run demo.",
        { cause: error }
      );
    }
  }
  return undefined;
}

function fromEnv(cfg: Config): Config {
  const out = { ...cfg };
  if (process.env.SERVICE_HOST) out.service.host = process.env.SERVICE_HOST;
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

function validate(cfg: Config): Config {
  if (!cfg.service.host || typeof cfg.service.host !== "string") {
    throw new ActionableError(
      "CONFIG_INVALID",
      "The service host is empty or is not text.",
      "Set service.host in config.json or SERVICE_HOST to a loopback address such as 127.0.0.1."
    );
  }
  if (
    !Number.isInteger(cfg.service.port) ||
    cfg.service.port < 1 ||
    cfg.service.port > 65_535
  ) {
    throw new ActionableError(
      "CONFIG_INVALID",
      `The service port ${String(cfg.service.port)} is outside 1 to 65535.`,
      "Set service.port in config.json or PORT to an unused port such as 8080."
    );
  }
  if (!(["memory", "postgres"] as unknown[]).includes(cfg.store.driver)) {
    throw new ActionableError(
      "CONFIG_INVALID",
      `The store driver ${String(cfg.store.driver)} is not supported.`,
      "Use memory for the offline check or postgres for the local stack."
    );
  }
  if (cfg.llm.driver !== "mock") {
    throw new ActionableError(
      "CONFIG_INVALID",
      `The model driver ${String(cfg.llm.driver)} is not included in this kit.`,
      "Use mock for the offline check. Implement and test a separate adapter before using a remote model."
    );
  }
  if (
    cfg.store.driver === "postgres" &&
    (!cfg.store.postgres.host ||
      !Number.isInteger(cfg.store.postgres.port) ||
      cfg.store.postgres.port < 1 ||
      cfg.store.postgres.port > 65_535)
  ) {
    throw new ActionableError(
      "CONFIG_INVALID",
      "The database host or port is invalid.",
      "Set PGHOST and PGPORT, or use STORE_DRIVER=memory for the offline check."
    );
  }
  if (!Number.isInteger(cfg.cache.ttlSeconds) || cfg.cache.ttlSeconds < 1) {
    throw new ActionableError(
      "CONFIG_INVALID",
      `The cache TTL ${String(cfg.cache.ttlSeconds)} is not a positive integer.`,
      "Set cache.ttlSeconds to the number of seconds a verified answer may be reused."
    );
  }
  if (!cfg.escalation.queue || typeof cfg.escalation.queue !== "string") {
    throw new ActionableError(
      "CONFIG_INVALID",
      "The escalation queue is empty or is not text.",
      "Set escalation.queue to the local queue name that should own handoffs."
    );
  }
  return cfg;
}

/**
 * Resolve runtime config. Order of precedence, low to high:
 * built in defaults, config.json, environment variables. The defaults run the
 * kit fully offline with a mock store and a mock model, so no secret is needed.
 */
export function loadConfig(): Config {
  const merged = deepMerge(defaults(), fromFile());
  return validate(fromEnv(merged));
}
