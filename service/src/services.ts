import type { Config } from "./config.js";
import { loadData } from "./adapters/data.js";
import { createMockShopify } from "./adapters/shopifyMock.js";
import { createMockLlm } from "./adapters/llmMock.js";
import { makeClassifier } from "./classify.js";
import { makeTools } from "./tools/index.js";
import { makeCache } from "./cache.js";
import { makePipeline } from "./pipeline.js";
import { createStore } from "./store/index.js";

/**
 * Wire the whole service together from config. This is the single composition
 * root, used by the HTTP server, the demo, and the tests.
 */
export async function createServices(config: Config) {
  const data = loadData(config.dataDir);
  const store = await createStore(config);
  await store.init();

  const shopify = createMockShopify(data);
  const llm = createMockLlm();
  const classify = makeClassifier(data.faq);
  const tools = makeTools({ shopify, data, store, config });
  const cache = makeCache(store, config);
  const pipeline = makePipeline({ classify, tools, cache, store, llm, config });

  return { config, data, store, shopify, llm, classify, tools, cache, pipeline };
}

export type Services = Awaited<ReturnType<typeof createServices>>;
