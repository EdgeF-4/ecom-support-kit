import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createServices } from "./services.js";

interface DemoMessage {
  label: string;
  message: string;
}

export interface DemoSummary {
  messages: number;
  tickets: number;
  modelCalls: number;
  repeatCached: boolean;
  routes: Record<string, number>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(here, "..", "..");
const demoRoot = path.resolve(serviceRoot, "..", "demo");

function loadMessages(filename: string): DemoMessage[] {
  const parsed: unknown = JSON.parse(readFileSync(filename, "utf8"));
  if (
    !Array.isArray(parsed) ||
    !parsed.length ||
    parsed.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        typeof (item as DemoMessage).label !== "string" ||
        typeof (item as DemoMessage).message !== "string"
    )
  ) {
    throw new Error("demo messages must be a non-empty array of label and message objects");
  }
  return parsed as DemoMessage[];
}

function oneLine(value: string): string {
  return value.replace(/\s*\n+\s*/g, " ");
}

export async function runDemo(
  dataDir = path.join(demoRoot, "sample_data"),
  messagesFile = path.join(demoRoot, "sample_messages.json")
): Promise<DemoSummary> {
  const messages = loadMessages(messagesFile);
  const config = loadConfig();
  config.dataDir = dataDir;
  config.store.driver = "memory";
  config.llm.driver = "mock";

  const svc = await createServices(config);
  const routes: Record<string, number> = {};

  console.log("ecom-support-kit: offline portfolio demo");
  console.log("Synthetic storefront, in-memory tickets, and deterministic mock model.");
  console.log("No credentials, containers, paid calls, or network access.");
  console.log("=".repeat(72));

  try {
    console.log("\n[1/4] Load a synthetic storefront");
    console.log(
      `  ${svc.data.orders.length} order, ${svc.data.products.length} product, ` +
        `${svc.data.faq.length} FAQ entries, ${svc.data.booking.length} booking slots`
    );

    console.log("\n[2/4] Route customer messages through the real support pipeline");
    for (const sample of messages) {
      const result = await svc.pipeline({ message: sample.message });
      routes[result.route] = (routes[result.route] || 0) + 1;
      console.log(`\n  ${sample.label}`);
      console.log(`  customer: ${sample.message}`);
      console.log(
        `  route=${result.route}  intent=${result.intent}  ` +
          `status=${result.status}  ticket=#${result.ticketId}`
      );
      console.log(`  reply: ${oneLine(result.reply)}`);
    }

    console.log("\n[3/4] Repeat the multi-tool question to exercise the answer cache");
    const multiTool = messages.find((sample) => sample.label === "multi-tool answer");
    if (!multiTool) throw new Error("demo dataset needs a multi-tool answer sample");
    const repeat = await svc.pipeline({ message: multiTool.message });
    const cache = await svc.store.cacheStats();
    console.log(`  served from cache: ${repeat.cached}`);
    console.log(`  model calls total: ${svc.llm.callCount}`);
    console.log(`  cache entries/hits: ${cache.entries}/${cache.hits}`);

    console.log("\n[4/4] Confirm the operational trail");
    const tickets = await svc.store.listTickets();
    console.log(`  tickets persisted: ${tickets.length}`);
    console.log(
      "  route coverage: " +
        ["deterministic", "model", "escalate", "out_of_scope"]
          .map((route) => `${route}=${routes[route] || 0}`)
          .join(", ")
    );

    console.log("\nDemo complete. Every message was answered, declined, or handed off with a ticket.");
    return {
      messages: messages.length,
      tickets: tickets.length,
      modelCalls: svc.llm.callCount,
      repeatCached: repeat.cached,
      routes,
    };
  } finally {
    await svc.store.close();
  }
}

async function main(): Promise<void> {
  await runDemo(process.argv[2], process.argv[3]);
}

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
