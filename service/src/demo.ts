import { loadConfig } from "./config.js";
import { createServices } from "./services.js";
import { formatActionable } from "./errors.js";

const SAMPLES = [
  "Where is my order #1001?",
  "What is your return policy?",
  "Where is my order #1001 and can I return the scarf in it?",
  "I want to book a fitting next week",
  "Can you write me a poem about the ocean?",
  "This is urgent, I need to speak to a person",
];

function pad(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}

async function main(): Promise<void> {
  const config = loadConfig();
  config.store.driver = "memory";
  const svc = await createServices(config);

  console.log("ecom-support-kit offline demo (mock store, mock model)");
  console.log("=".repeat(64));

  for (const message of SAMPLES) {
    const r = await svc.pipeline({ message });
    console.log(`\n> ${message}`);
    console.log(
      `  ${pad("route=" + r.route, 24)} intent=${r.intent}  confidence=${r.confidence}  ticket=#${r.ticketId}`
    );
    console.log("  reply: " + r.reply.replace(/\s*\n+\s*/g, " "));
  }

  // Ask a model route question again to show the cache avoiding a second call.
  const repeat = await svc.pipeline({ message: SAMPLES[2] });
  const stats = await svc.store.cacheStats();

  console.log("\n" + "-".repeat(64));
  console.log(`model calls made:        ${svc.llm.callCount}`);
  console.log(`repeat served from cache: ${repeat.cached}`);
  console.log(`cache entries / hits:     ${stats.entries} / ${stats.hits}`);
  await svc.store.close();
}

main().catch((e) => {
  console.error(formatActionable(e));
  process.exit(1);
});
