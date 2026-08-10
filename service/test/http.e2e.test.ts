import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createServices } from "../src/services.js";
import { createServer } from "../src/server.js";
import { testConfig } from "./helpers.js";

async function boot() {
  const svc = await createServices(testConfig());
  const server = createServer(svc);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return { svc, server, base: `http://127.0.0.1:${port}` };
}

function postJson(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((response) => response.json());
}

function postRaw(base: string, path: string, body: string) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

test("http surface: health, support, protocol, tickets, and error reporting", async () => {
  const { svc, server, base } = await boot();
  try {
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.status, "ok");

    const support = await postJson(base, "/support", {
      message: "where is my order #1001",
    });
    assert.equal(support.route, "deterministic");
    assert.match(support.reply, /1001/);

    const init = await postJson(base, "/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });
    assert.equal(init.result.serverInfo.name, "ecom-support-kit");

    const list = await postJson(base, "/mcp", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const names = list.result.tools.map((tool: { name: string }) => tool.name).sort();
    assert.deepEqual(names, [
      "check_booking",
      "escalate",
      "faq_retrieval",
      "order_lookup",
    ]);

    const call = await postJson(base, "/mcp", {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "order_lookup", arguments: { orderId: "1001" } },
    });
    const payload = JSON.parse(call.result.content[0].text);
    assert.equal(payload.found, true);

    const chat = await postJson(base, "/v1/chat/completions", {
      model: "offline-model",
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(chat.object, "chat.completion");
    assert.ok(chat.choices[0].message.content.length > 0);

    const report = await postJson(base, "/errors", {
      workflow: "Support Intake",
      node: "Classify",
      error: "boom",
      input: { a: 1 },
    });
    assert.equal(report.ok, true);
    const errors = await (await fetch(`${base}/errors`)).json();
    assert.equal(errors.errors[0].error, "boom");
    assert.equal(errors.errors[0].node, "Classify");

    const created = await postJson(base, "/tickets", {
      message: "fixture",
      channel: "web",
      status: "resolved",
      route: "deterministic",
      reply: "fixture reply",
    });
    assert.ok(created.id > 0);
  } finally {
    server.close();
    await svc.store.close();
  }
});

test("http failures return a code, cause, and next action", async () => {
  const { svc, server, base } = await boot();
  try {
    const invalidJson = await postRaw(base, "/support", "{");
    assert.equal(invalidJson.status, 400);
    const invalidProblem = await invalidJson.json();
    assert.equal(invalidProblem.error, "INVALID_JSON");
    assert.match(invalidProblem.message, /valid JSON object/i);
    assert.match(invalidProblem.next, /retry/i);

    const missingMessage = await postJson(base, "/support", {});
    assert.equal(missingMessage.error, "INVALID_INPUT");
    assert.match(missingMessage.next, /message/i);

    const unknownToolResponse = await postRaw(base, "/tools/missing", "{}");
    assert.equal(unknownToolResponse.status, 404);
    const unknownTool = await unknownToolResponse.json();
    assert.equal(unknownTool.error, "UNKNOWN_TOOL");
    assert.match(unknownTool.next, /GET \/tools/);

    const missingRoute = await fetch(`${base}/missing`);
    assert.equal(missingRoute.status, 404);
    const routeProblem = await missingRoute.json();
    assert.equal(routeProblem.error, "ROUTE_NOT_FOUND");
    assert.match(routeProblem.next, /README\.md/);

    const invalidChat = await postJson(base, "/v1/chat/completions", {});
    assert.equal(invalidChat.error, "INVALID_CHAT_INPUT");
    assert.match(invalidChat.next, /messages array/i);

    const badMethod = await postJson(base, "/mcp", {
      jsonrpc: "2.0",
      id: 10,
      method: "missing/method",
    });
    assert.equal(badMethod.error.code, -32601);
    assert.match(badMethod.error.message, /Next:/);

    const badTool = await postJson(base, "/mcp", {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "missing", arguments: {} },
    });
    assert.equal(badTool.error.code, -32602);
    assert.match(badTool.error.message, /tools\/list/);
  } finally {
    server.close();
    await svc.store.close();
  }
});
