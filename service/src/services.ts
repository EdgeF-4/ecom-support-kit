import type { Config } from "./config.js";
import { loadData } from "./adapters/data.js";
import { createMockShopify } from "./adapters/shopifyMock.js";
import { createMockLlm } from "./adapters/llmMock.js";
import { makeClassifier } from "./classify.js";
import { makeTools } from "./tools/index.js";
import { makeCache } from "./cache.js";
import { makePipeline } from "./pipeline.js";
import { createStore } from "./store/index.js";
import { ActionableError } from "./errors.js";

/**
 * Wire the whole service together from config. This is the single composition
 * root, used by the HTTP server, the demo, and the tests.
 */
export async function createServices(config: Config) {
  const data = loadData(config.dataDir);
  const store = await createStore(config);
  try {
    await store.init();
  } catch (error) {
    await store.close().catch(() => undefined);
    const db = config.store.postgres;
    throw new ActionableError(
      "STORE_UNAVAILABLE",
      config.store.driver === "postgres"
        ? `Cannot initialize the ticket database at ${db.host}:${db.port}.`
        : "Cannot initialize the in-memory ticket store.",
      config.store.driver === "postgres"
        ? "Start it with docker compose -f ../docker-compose.yml up -d postgres, or set STORE_DRIVER=memory for the offline check."
        : "Restart the command. If it repeats, run npm test and report the failing test name.",
      { cause: error }
    );
  }

  const shopify = createMockShopify(data);
  const llm = createMockLlm();
  const classify = makeClassifier(data.faq);
  const tools = makeTools({ shopify, data, store, config });
  const cache = makeCache(store, config);
  const pipeline = makePipeline({ classify, tools, cache, store, llm, config });

  return { config, data, store, shopify, llm, classify, tools, cache, pipeline };
}

export type Services = Awaited<ReturnType<typeof createServices>>;
