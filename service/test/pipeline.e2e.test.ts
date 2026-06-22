import { test } from "node:test";
import assert from "node:assert/strict";
import { createServices } from "../src/services.js";
import { testConfig } from "./helpers.js";

test("offline end to end across every route, with caching", async () => {
  const svc = await createServices(testConfig());

  // Deterministic path: answered from store data, no model call.
  const order = await svc.pipeline({ message: "where is my order #1001" });
  assert.equal(order.route, "deterministic");
  assert.match(order.reply, /1001/);
  assert.equal(svc.llm.callCount, 0);

  // Out of scope: declined, not answered like a general chatbot.
  const refuse = await svc.pipeline({ message: "tell me a joke" });
  assert.equal(refuse.route, "out_of_scope");

  // Escalation: routed to a human, ticket marked escalated.
  const esc = await svc.pipeline({ message: "let me talk to a person" });
  assert.equal(esc.status, "escalated");

  // Model path: needs synthesis across two tools.
  const q = "where is my order #1001 and what is your return policy";
  const first = await svc.pipeline({ message: q });
  assert.equal(first.route, "model");
  assert.equal(first.cached, false);
  assert.equal(svc.llm.callCount, 1);
  assert.match(first.reply, /1001/);
  assert.match(first.reply, /refund/i);

  // Same question again is served from cache, so no second model call.
  const again = await svc.pipeline({ message: q });
  assert.equal(again.cached, true);
  assert.equal(again.reply, first.reply);
  assert.equal(svc.llm.callCount, 1);

  // Every message produced exactly one persisted ticket (5 so far).
  const tickets = await svc.store.listTickets();
  assert.equal(tickets.length, 5);

  const stats = await svc.store.cacheStats();
  assert.equal(stats.hits, 1);

  await svc.store.close();
});
