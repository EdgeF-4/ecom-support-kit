import type { Classification, FaqEntry } from "./types.js";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function extractOrderId(message: string): string | null {
  const hash = message.match(/#\s?(\d{3,8})/);
  if (hash) return hash[1];
  const ord = message.match(/order\s*#?\s*(\d{3,8})/i);
  if (ord) return ord[1];
  return null;
}

/**
 * Deterministic, rule based classifier. It runs before any model call and
 * decides one of four routes: answer from store data with no model
 * (deterministic), synthesize an in scope answer with the model, escalate to a
 * human, or decline because the request is outside the supported tasks.
 *
 * Keeping this deterministic is what keeps the kit cheap and predictable: most
 * questions never reach a paid model, and out of scope requests are refused
 * instead of answered freely.
 */
export function makeClassifier(faq: FaqEntry[]) {
  const faqIndex = faq.map((f) => ({
    topic: f.topic,
    keywords: f.keywords.map((k) => k.toLowerCase()),
  }));

  return function classify(input: {
    message: string;
    email?: string | null;
    channel?: string;
  }): Classification {
    const message = (input.message || "").trim();
    const channel = input.channel || "web";
    const lower = message.toLowerCase();
    const emailFromMsg = (message.match(EMAIL_RE) || [])[0] || null;
    const email = (input.email && input.email.trim()) || emailFromMsg;

    const topics: string[] = [];
    const base = { message, email, channel, topics };

    if (!message) {
      return {
        ...base,
        route: "escalate",
        intent: "human_handoff",
        tool: null,
        toolInput: {},
        scopeOk: true,
        confidence: 0.2,
        reason: "empty_message",
      };
    }

    const human =
      /\b(human|representative|real person|live person|live agent|customer service rep|speak to (someone|a person|an agent)|talk to (someone|a person|an agent)|connect me to (someone|a person))\b/i.test(
        message
      );

    const orderId = extractOrderId(message);
    const hasOrderRef =
      !!orderId ||
      /\bmy order\b|\border\s*#?\s*\d|where('?s| is| are)? my (order|package|parcel)|order status|status of my order|track(ing)? (my )?(order|package|parcel)/i.test(
        lower
      );
    const tReturns =
      /\breturn(s|ed|ing)?\b|\brefund|\bexchange|send (it |this )?back|money back|\brma\b/i.test(
        lower
      );
    const tShipping =
      /\bship(ping|ped|s)?\b|\bdelivery\b|\bdeliver\b|how long.*(ship|deliver|arrive)|when will.*(arrive|ship|deliver)|courier|postage/i.test(
        lower
      );
    const tBooking =
      /\bbook\b|booking|appointment|schedule|consultation|fitting|reserve (a )?(time|slot|spot)/i.test(
        lower
      );

    const matchesKeyword = (k: string) =>
      new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower);
    let faqTopic: string | null = null;
    for (const f of faqIndex) {
      if (f.topic === "returns" || f.topic === "shipping") continue;
      if (f.keywords.some(matchesKeyword)) {
        faqTopic = f.topic;
        break;
      }
    }

    if (hasOrderRef) topics.push("order");
    if (tReturns) topics.push("returns");
    if (tBooking) topics.push("booking");
    if (tShipping && !hasOrderRef) topics.push("shipping");
    if (faqTopic && !topics.includes("faq")) topics.push("faq");

    if (human) {
      return {
        ...base,
        route: "escalate",
        intent: "human_handoff",
        tool: null,
        toolInput: {},
        scopeOk: true,
        confidence: 0.99,
        reason: "human_requested",
      };
    }

    if (topics.length === 0) {
      return {
        ...base,
        route: "out_of_scope",
        intent: "out_of_scope",
        tool: null,
        toolInput: {},
        scopeOk: false,
        confidence: 0.9,
        reason: "no_supported_topic",
      };
    }

    if (topics.length >= 2) {
      return {
        ...base,
        route: "model",
        intent: "multi_topic",
        tool: null,
        toolInput: { orderId, email, faqTopic },
        scopeOk: true,
        confidence: 0.75,
        reason: `multi_topic:${topics.join("+")}`,
      };
    }

    switch (topics[0]) {
      case "order":
        return {
          ...base,
          route: "deterministic",
          intent: "order_status",
          tool: "order_lookup",
          toolInput: { orderId, email },
          scopeOk: true,
          confidence: orderId || email ? 0.92 : 0.7,
          reason: orderId ? "order_id" : email ? "order_email" : "order_no_ref",
        };
      case "returns":
        return {
          ...base,
          route: "deterministic",
          intent: "returns",
          tool: "faq_retrieval",
          toolInput: { query: message, topic: "returns" },
          scopeOk: true,
          confidence: 0.9,
          reason: "returns",
        };
      case "shipping":
        return {
          ...base,
          route: "deterministic",
          intent: "shipping",
          tool: "faq_retrieval",
          toolInput: { query: message, topic: "shipping" },
          scopeOk: true,
          confidence: 0.9,
          reason: "shipping",
        };
      case "booking":
        return {
          ...base,
          route: "deterministic",
          intent: "booking",
          tool: "check_booking",
          toolInput: { topic: /fitting/i.test(lower) ? "fitting" : "consultation" },
          scopeOk: true,
          confidence: 0.88,
          reason: "booking",
        };
      default:
        return {
          ...base,
          route: "deterministic",
          intent: "faq",
          tool: "faq_retrieval",
          toolInput: { query: message, topic: faqTopic },
          scopeOk: true,
          confidence: 0.9,
          reason: `faq:${faqTopic}`,
        };
    }
  };
}
