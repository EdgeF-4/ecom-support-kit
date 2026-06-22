import http from "node:http";
import type { Services } from "./services.js";
import { handleMcp } from "./mcp.js";
import { handleChatCompletion } from "./openaiMock.js";

function send(res: http.ServerResponse, status: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({ __parseError: true });
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * HTTP surface for the tool service. Uses only the Node standard library, so
 * the service has a tiny dependency footprint.
 */
export function createServer(svc: Services): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const path = url.pathname;
      const method = req.method || "GET";

      if (method === "GET" && path === "/health") {
        return send(res, 200, {
          status: "ok",
          store: svc.config.store.driver,
          llm: svc.config.llm.driver,
        });
      }

      if (method === "POST" && path === "/classify") {
        const b = await readBody(req);
        return send(res, 200, svc.classify(b as { message: string }));
      }

      if (method === "POST" && path === "/support") {
        const b = await readBody(req);
        return send(res, 200, await svc.pipeline(b as { message: string }));
      }

      if (method === "POST" && path.startsWith("/tools/")) {
        const name = path.slice("/tools/".length);
        const fn = (svc.tools as unknown as Record<string, unknown>)[name];
        if (typeof fn !== "function")
          return send(res, 404, { error: `unknown tool: ${name}` });
        const b = await readBody(req);
        return send(res, 200, await (fn as (i: unknown) => Promise<unknown>)(b));
      }

      if (method === "POST" && path === "/mcp") {
        const b = await readBody(req);
        const r = await handleMcp(svc.tools, b);
        if (r.body === null) {
          res.writeHead(r.status);
          return res.end();
        }
        return send(res, r.status, r.body);
      }

      if (method === "POST" && path === "/v1/chat/completions") {
        const b = await readBody(req);
        return send(res, 200, await handleChatCompletion(svc.llm, b));
      }

      if (method === "POST" && path === "/errors") {
        const b = await readBody(req);
        await svc.store.recordError(b);
        return send(res, 200, { ok: true });
      }

      if (method === "GET" && path === "/errors") {
        return send(res, 200, { errors: await svc.store.listErrors() });
      }

      if (method === "GET" && path === "/tickets") {
        return send(res, 200, { tickets: await svc.store.listTickets() });
      }

      if (method === "GET" && path === "/cache/stats") {
        return send(res, 200, await svc.store.cacheStats());
      }

      return send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  });
}
