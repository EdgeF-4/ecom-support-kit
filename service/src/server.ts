import http from "node:http";
import type { Services } from "./services.js";
import { handleMcp } from "./mcp.js";
import { handleChatCompletion } from "./chatMock.js";
import { ActionableError, formatActionable, toProblem } from "./errors.js";
import type { NewTicket } from "./types.js";

function send(res: http.ServerResponse, status: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      data += chunk;
      if (data.length > 1_000_000) {
        tooLarge = true;
        data = "";
      }
    });
    req.on("end", () => {
      if (tooLarge) {
        return reject(
          new ActionableError(
            "REQUEST_TOO_LARGE",
            "The request body exceeds the 1 MB limit.",
            "Send a smaller JSON body and retry the request.",
            { status: 413 }
          )
        );
      }
      try {
        const value = data ? JSON.parse(data) : {};
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new Error("JSON body is not an object");
        }
        resolve(value as Record<string, unknown>);
      } catch (error) {
        reject(
          new ActionableError(
            "INVALID_JSON",
            "The request body is not a valid JSON object.",
            "Send an object with content-type application/json and retry the request.",
            { cause: error, status: 400 }
          )
        );
      }
    });
    req.on("error", (error) =>
      reject(
        new ActionableError(
          "REQUEST_READ_FAILED",
          "The service could not read the request body.",
          "Retry the request. If it repeats, check the client connection and service log.",
          { cause: error, status: 400 }
        )
      )
    );
  });
}

function sendProblem(res: http.ServerResponse, error: unknown): void {
  const problem = toProblem(error);
  if (problem.status >= 500) console.error(formatActionable(error));
  send(res, problem.status, {
    error: problem.error,
    message: problem.message,
    next: problem.next,
  });
}

function requireMessage(body: Record<string, unknown>): asserts body is {
  message: string;
  email?: string | null;
  channel?: string;
} {
  if (typeof body.message !== "string") {
    throw new ActionableError(
      "INVALID_INPUT",
      "The message field is missing or is not text.",
      "Send JSON such as {\"message\":\"where is order 1001?\"} and retry the request.",
      { status: 400 }
    );
  }
}

function toTicket(body: Record<string, unknown>): NewTicket {
  const required = ["message", "channel", "status"] as const;
  const missing = required.find(
    (field) => typeof body[field] !== "string" || !String(body[field]).trim()
  );
  if (missing) {
    throw new ActionableError(
      "INVALID_TICKET",
      `The ticket field ${missing} is missing or is not text.`,
      "Send message, channel, and status as non-empty strings, then retry the request.",
      { status: 400 }
    );
  }
  return {
    message: String(body.message),
    customerEmail:
      typeof body.customerEmail === "string" ? body.customerEmail : null,
    channel: String(body.channel),
    intent: typeof body.intent === "string" ? body.intent : null,
    route: typeof body.route === "string" ? body.route : null,
    status: String(body.status),
    assignee: typeof body.assignee === "string" ? body.assignee : null,
    reply: typeof body.reply === "string" ? body.reply : null,
    confidence:
      typeof body.confidence === "number" ? body.confidence : null,
    metadata:
      typeof body.metadata === "object" &&
      body.metadata !== null &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {},
  };
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
        requireMessage(b);
        return send(res, 200, svc.classify(b));
      }

      if (method === "POST" && path === "/support") {
        const b = await readBody(req);
        requireMessage(b);
        return send(res, 200, await svc.pipeline(b));
      }

      if (method === "GET" && path === "/tools") {
        return send(res, 200, { tools: Object.keys(svc.tools).sort() });
      }

      if (method === "POST" && path.startsWith("/tools/")) {
        const name = path.slice("/tools/".length);
        const fn = (svc.tools as unknown as Record<string, unknown>)[name];
        if (typeof fn !== "function")
          throw new ActionableError(
            "UNKNOWN_TOOL",
            `The tool ${name || "(empty)"} does not exist.`,
            "Call GET /tools, choose one of the returned names, and retry the request.",
            { status: 404 }
          );
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

      if (method === "POST" && path === "/tickets") {
        const b = await readBody(req);
        return send(res, 201, await svc.store.createTicket(toTicket(b)));
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

      throw new ActionableError(
        "ROUTE_NOT_FOUND",
        `No ${method} route exists at ${path}.`,
        "Check README.md for the supported routes, or call GET /health to verify the service.",
        { status: 404 }
      );
    } catch (e) {
      sendProblem(res, e);
    }
  });
}
