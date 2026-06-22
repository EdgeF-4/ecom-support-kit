import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/adapters/data.js";
import { makeClassifier } from "../src/classify.js";
import { loadConfig } from "../src/config.js";

const data = loadData(loadConfig().dataDir);
const classify = makeClassifier(data.faq);

test("order number routes deterministic order_lookup", () => {
  const c = classify({ message: "Where is my order #1001?" });
  assert.equal(c.route, "deterministic");
  assert.equal(c.intent, "order_status");
  assert.equal(c.tool, "order_lookup");
  assert.equal((c.toolInput as { orderId?: string }).orderId, "1001");
});

test("return policy routes deterministic returns with no model call", () => {
  const c = classify({ message: "what is your return policy" });
  assert.equal(c.route, "deterministic");
  assert.equal(c.intent, "returns");
});

test("shipping question routes deterministic shipping", () => {
  const c = classify({ message: "how long does shipping take" });
  assert.equal(c.route, "deterministic");
  assert.equal(c.intent, "shipping");
});

test("payment question routes to the FAQ", () => {
  const c = classify({ message: "what payment methods do you accept" });
  assert.equal(c.route, "deterministic");
  assert.equal(c.intent, "faq");
});

test("multi topic message routes to the model", () => {
  const c = classify({
    message: "where is my order #1001 and can I return the scarf",
  });
  assert.equal(c.route, "model");
  assert.ok(c.topics.includes("order"));
  assert.ok(c.topics.includes("returns"));
});

test("book a fitting is single topic booking, not multi topic", () => {
  const c = classify({ message: "I want to book a fitting next week" });
  assert.equal(c.route, "deterministic");
  assert.equal(c.intent, "booking");
  assert.equal((c.toolInput as { topic?: string }).topic, "fitting");
});

test("out of scope request is refused, not answered", () => {
  const c = classify({ message: "write me a poem about the ocean" });
  assert.equal(c.route, "out_of_scope");
  assert.equal(c.scopeOk, false);
});

test("explicit request for a human escalates", () => {
  const c = classify({ message: "I need to speak to a person" });
  assert.equal(c.route, "escalate");
  assert.equal(c.intent, "human_handoff");
});

test("email is extracted from the message body", () => {
  const c = classify({
    message: "status of my order, my email is sam@example.com",
  });
  assert.equal(c.email, "sam@example.com");
  assert.equal(c.intent, "order_status");
});

test("empty message escalates rather than guessing", () => {
  const c = classify({ message: "   " });
  assert.equal(c.route, "escalate");
});
