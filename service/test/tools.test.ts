import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/adapters/data.js";
import { loadConfig } from "../src/config.js";
import { createMockShopify } from "../src/adapters/shopifyMock.js";
import { makeOrderLookup } from "../src/tools/orderLookup.js";
import { makeFaqRetrieval } from "../src/tools/faqRetrieval.js";
import { makeCheckBooking } from "../src/tools/booking.js";
import { makeEscalate } from "../src/tools/escalation.js";
import { createMemoryStore } from "../src/store/memory.js";
import { testConfig } from "./helpers.js";

const data = loadData(loadConfig().dataDir);

// order_lookup -------------------------------------------------------------
const lookup = makeOrderLookup(createMockShopify(data));

test("order_lookup finds a shipped order with tracking", async () => {
  const r = (await lookup({ orderId: "1001" })) as { found: boolean; reply: string };
  assert.equal(r.found, true);
  assert.match(r.reply, /on its way/);
  assert.match(r.reply, /1Z999AA10123456784/);
});

test("order_lookup strips the hash and ignores case", async () => {
  const r = (await lookup({ orderId: "#1001" })) as { found: boolean };
  assert.equal(r.found, true);
});

test("order_lookup finds the latest order by email", async () => {
  const r = (await lookup({ email: "jo@example.com" })) as { found: boolean; reply: string };
  assert.equal(r.found, true);
  assert.match(r.reply, /refund/i);
});

test("order_lookup asks for details when none are given", async () => {
  const r = (await lookup({})) as { found: boolean; reply: string };
  assert.equal(r.found, false);
  assert.match(r.reply, /order number/i);
});

test("order_lookup reports an unknown order as not found", async () => {
  const r = (await lookup({ orderId: "9999" })) as { found: boolean };
  assert.equal(r.found, false);
});

// faq_retrieval ------------------------------------------------------------
const faqR = makeFaqRetrieval(data.faq);

test("faq_retrieval ranks the topic match first", async () => {
  const r = (await faqR({ query: "can I get a refund", topic: "returns" })) as {
    matches: { topic: string }[];
  };
  assert.equal(r.matches[0].topic, "returns");
});

test("faq_retrieval finds payment info from the question alone", async () => {
  const r = (await faqR({ query: "what payment methods do you accept" })) as {
    matches: { topic: string }[];
  };
  assert.equal(r.matches[0].topic, "payment");
});

test("faq_retrieval returns a helpful fallback on no match", async () => {
  const r = (await faqR({ query: "qwerty zxcvb nonsense" })) as {
    matches: unknown[];
    reply: string;
  };
  assert.equal(r.matches.length, 0);
  assert.match(r.reply, /could not find/i);
});

// check_booking ------------------------------------------------------------
const booking = makeCheckBooking(data.booking);

test("check_booking filters slots by topic", async () => {
  const r = (await booking({ topic: "fitting" })) as {
    slots: { topic: string }[];
  };
  assert.ok(r.slots.length > 0);
  assert.ok(r.slots.every((s) => s.topic === "fitting"));
});

test("check_booking returns slots when no topic is given", async () => {
  const r = (await booking({})) as { slots: unknown[]; reply: string };
  assert.ok(r.slots.length > 0);
  assert.match(r.reply, /only checks availability/i);
  assert.doesNotMatch(r.reply, /reserve it for you|lock it in/i);
});

// escalate -----------------------------------------------------------------
test("escalate opens an escalated ticket and returns a reference", async () => {
  const store = createMemoryStore();
  const cfg = testConfig();
  const escalate = makeEscalate(store, cfg);
  const r = (await escalate({
    message: "help me",
    email: "customer@example.com",
    reason: "test",
  })) as { ticketId: number; queue: string; reply: string };

  assert.ok(r.ticketId > 0);
  assert.equal(r.queue, cfg.escalation.queue);
  assert.match(r.reply, /opened a support ticket/i);
  const tickets = await store.listTickets();
  assert.equal(tickets[0].status, "escalated");
  assert.equal(tickets[0].customerEmail, "customer@example.com");
});
