import type { Tools } from "./tools/index.js";

/**
 * Tool definitions advertised over MCP. The n8n MCP Client node reads this list
 * and lets the agent call any of them.
 */
export const TOOL_DEFS = [
  {
    name: "order_lookup",
    description:
      "Look up an order by order number or email and return its status and tracking.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order number, for example 1001" },
        email: { type: "string", description: "Email used at checkout" },
      },
    },
  },
  {
    name: "faq_retrieval",
    description: "Retrieve the best matching store FAQ answers for a question.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        topic: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "check_booking",
    description:
      "List available booking slots, optionally filtered by topic (consultation or fitting).",
    inputSchema: {
      type: "object",
      properties: { topic: { type: "string" } },
    },
  },
  {
    name: "escalate",
    description: "Open a support ticket and route it to a human queue.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        email: { type: "string" },
        reason: { type: "string" },
      },
      required: ["message"],
    },
  },
];

interface JsonRpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export interface McpReply {
  status: number;
  body: unknown | null;
}

/**
 * Minimal MCP server over streamable HTTP. Supports initialize, the initialized
 * notification, ping, tools/list, and tools/call, which is everything the n8n
 * MCP Client node needs to discover and call the tools.
 */
export async function handleMcp(tools: Tools, body: JsonRpc): Promise<McpReply> {
  const id = body?.id ?? null;
  const ok = (result: unknown): McpReply => ({
    status: 200,
    body: { jsonrpc: "2.0", id, result },
  });
  const fail = (code: number, message: string): McpReply => ({
    status: 200,
    body: { jsonrpc: "2.0", id, error: { code, message } },
  });

  switch (body?.method) {
    case "initialize":
      return ok({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "ecom-support-kit", version: "1.0.0" },
      });
    case "notifications/initialized":
      return { status: 202, body: null };
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOL_DEFS });
    case "tools/call": {
      const name = body.params?.name;
      const args = body.params?.arguments ?? {};
      const fn = name ? (tools as unknown as Record<string, unknown>)[name] : undefined;
      if (typeof fn !== "function") return fail(-32602, `unknown tool: ${name}`);
      try {
        const out = await (fn as (i: unknown) => Promise<unknown>)(args);
        return ok({ content: [{ type: "text", text: JSON.stringify(out) }], isError: false });
      } catch (e) {
        return ok({
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }
    default:
      return fail(-32601, `method not found: ${body?.method}`);
  }
}
