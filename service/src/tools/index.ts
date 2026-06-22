import type { Config } from "../config.js";
import type { ShopifyAdapter } from "../adapters/shopifyMock.js";
import type { Store } from "../store/index.js";
import type { StoreData, ToolResult } from "../types.js";
import { makeOrderLookup } from "./orderLookup.js";
import { makeFaqRetrieval } from "./faqRetrieval.js";
import { makeCheckBooking } from "./booking.js";
import { makeEscalate } from "./escalation.js";

export interface Tools {
  order_lookup(i: { orderId?: string | null; email?: string | null }): Promise<ToolResult>;
  faq_retrieval(i: { query: string; topic?: string | null; limit?: number }): Promise<ToolResult>;
  check_booking(i: { topic?: string | null }): Promise<ToolResult>;
  escalate(i: {
    message: string;
    email?: string | null;
    reason?: string;
    intent?: string;
  }): Promise<ToolResult>;
}

export function makeTools(deps: {
  shopify: ShopifyAdapter;
  data: StoreData;
  store: Store;
  config: Config;
}): Tools {
  return {
    order_lookup: makeOrderLookup(deps.shopify),
    faq_retrieval: makeFaqRetrieval(deps.data.faq),
    check_booking: makeCheckBooking(deps.data.booking),
    escalate: makeEscalate(deps.store, deps.config),
  };
}
