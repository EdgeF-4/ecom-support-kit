import type { Config } from "./config.js";
import type { LlmAdapter } from "./adapters/llmMock.js";
import type { Cache } from "./cache.js";
import type { Store } from "./store/index.js";
import type { Tools } from "./tools/index.js";
import { buildEscalation } from "./tools/escalation.js";
import type { Classification } from "./types.js";

const REFUSAL =
  "I can only help with store support such as order status, returns, shipping, our FAQ, and booking. I am not able to help with that request, but I can connect you with a member of our team if you like.";

const SYSTEM =
  "You are a scoped support assistant. Use only the provided store data. Stay within order status, returns, shipping, FAQ, and booking. Never invent order details.";

export interface SupportInput {
  message: string;
  email?: string | null;
  channel?: string;
}

export interface SupportResult {
  reply: string;
  intent: string;
  route: string;
  status: string;
  confidence: number;
  ticketId: number;
  cached: boolean;
}

/**
 * The orchestration the n8n intake workflow performs, expressed in one place so
 * the kit can answer end to end without n8n (used by POST /support, the demo,
 * and the offline tests). The decision graph matches the workflow exactly.
 */
export function makePipeline(deps: {
  classify: (i: SupportInput) => Classification;
  tools: Tools;
  cache: Cache;
  store: Store;
  llm: LlmAdapter;
  config: Config;
}) {
  const { classify, tools, cache, store, llm, config } = deps;

  async function gatherContext(c: Classification): Promise<string> {
    const ti = c.toolInput as { orderId?: string | null; faqTopic?: string | null };
    const ctx: string[] = [];
    if (c.topics.includes("order"))
      ctx.push((await tools.order_lookup({ orderId: ti.orderId, email: c.email })).reply);
    if (c.topics.includes("returns"))
      ctx.push((await tools.faq_retrieval({ query: c.message, topic: "returns" })).reply);
    if (c.topics.includes("shipping"))
      ctx.push((await tools.faq_retrieval({ query: c.message, topic: "shipping" })).reply);
    if (c.topics.includes("faq"))
      ctx.push(
        (await tools.faq_retrieval({ query: c.message, topic: ti.faqTopic ?? null })).reply
      );
    if (c.topics.includes("booking"))
      ctx.push((await tools.check_booking({})).reply);
    if (!ctx.length) ctx.push((await tools.faq_retrieval({ query: c.message })).reply);
    return ctx.join("\n");
  }

  return async function handleMessage(input: SupportInput): Promise<SupportResult> {
    const c = classify(input);

    // Cost control: a repeated question short circuits here. Escalation is
    // skipped because it has a side effect (a new ticket) every time.
    if (c.route !== "escalate") {
      const cached = await cache.get(c.message, c.route);
      if (cached) {
        const r = cached.response as Omit<SupportResult, "ticketId" | "cached">;
        const t = await store.createTicket({
          message: c.message,
          customerEmail: c.email,
          channel: c.channel,
          intent: r.intent,
          route: r.route,
          status: r.status,
          assignee: null,
          reply: r.reply,
          confidence: r.confidence,
          metadata: { cached: true },
        });
        return { ...r, ticketId: t.id, cached: true };
      }
    }

    let reply = "";
    let status = "resolved";
    let assignee: string | null = null;

    if (c.route === "deterministic") {
      const fn = tools[c.tool as keyof Tools] as (i: unknown) => Promise<{ reply: string }>;
      reply = (await fn(c.toolInput)).reply;
    } else if (c.route === "model") {
      const context = await gatherContext(c);
      reply = (await llm.complete({ system: SYSTEM, user: c.message, context })).text;
    } else if (c.route === "escalate") {
      const plan = buildEscalation({ intent: c.intent, reason: c.reason }, config);
      reply = plan.reply;
      status = plan.status;
      assignee = plan.assignee;
    } else {
      reply = REFUSAL;
    }

    const t = await store.createTicket({
      message: c.message,
      customerEmail: c.email,
      channel: c.channel,
      intent: c.intent,
      route: c.route,
      status,
      assignee,
      reply,
      confidence: c.confidence,
      metadata: { reason: c.reason, topics: c.topics },
    });

    const response = {
      reply,
      intent: c.intent,
      route: c.route,
      status,
      confidence: c.confidence,
    };

    if (c.route !== "escalate") {
      await cache.set(
        c.message,
        c.route,
        response,
        c.route === "model" ? "llm" : "deterministic"
      );
    }

    return { ...response, ticketId: t.id, cached: false };
  };
}

export type Pipeline = ReturnType<typeof makePipeline>;
