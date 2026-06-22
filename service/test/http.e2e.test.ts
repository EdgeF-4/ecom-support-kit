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
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return { svc, server, base: `http://127.0.0.1:${port}` };
}

function postJson(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

test("http surface: health, support, mcp, chat completion, error reporting", async () => {
  const { svc, server, base } = await boot();
  try {
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.status, "ok");

    const support = await postJson(base, "/support", {
      message: "where is my order #1001",
    });
    assert.equal(support.route, "deterministic");
    assert.match(support.reply, /1001/);

    // MCP: initialize, list, call.
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
    const names = list.result.tools.map((t: { name: string }) => t.name).sort();
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

    // OpenAI compatible mock used by the n8n chat model node.
    const chat = await postJson(base, "/v1/chat/completions", {
      model: "your-model-name",
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(chat.object, "chat.completion");
    assert.ok(chat.choices[0].message.content.length > 0);

    // Error workflow reporting: post a failure, then read it back.
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
  } finally {
    server.close();
    await svc.store.close();
  }
});
