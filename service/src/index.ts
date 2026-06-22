import { loadConfig } from "./config.js";
import { createServices } from "./services.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const svc = await createServices(config);
  const server = createServer(svc);

  server.listen(config.service.port, config.service.host, () => {
    console.log(
      `tool service listening on ${config.service.host}:${config.service.port} ` +
        `(store=${config.store.driver}, llm=${config.llm.driver})`
    );
  });

  const shutdown = async () => {
    server.close();
    await svc.store.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error("failed to start tool service:", e);
  process.exit(1);
});
