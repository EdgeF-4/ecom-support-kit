import { loadConfig, type Config } from "../src/config.js";

/**
 * Config for tests: forces the in memory store and the mock model so the suite
 * runs fully offline with no Postgres and no network.
 */
export function testConfig(): Config {
  const c = loadConfig();
  c.store.driver = "memory";
  c.llm.driver = "mock";
  c.cache.enabled = true;
  return c;
}
