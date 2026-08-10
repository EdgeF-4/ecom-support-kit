import { loadConfig } from "./config.js";
import { createServices } from "./services.js";
import { createServer } from "./server.js";
import { ActionableError, formatActionable } from "./errors.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const svc = await createServices(config);
  const server = createServer(svc);

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error) => {
      reject(
        new ActionableError(
          "LISTEN_FAILED",
          `Cannot listen on ${config.service.host}:${config.service.port}.`,
          `Choose an unused loopback port with PORT=18080 npm start, or stop the process already using port ${config.service.port}.`,
          { cause: error }
        )
      );
    });
    server.listen(config.service.port, config.service.host, resolve);
  });
  console.log(
    `tool service listening on ${config.service.host}:${config.service.port} ` +
      `(store=${config.store.driver}, model=${config.llm.driver})`
  );

  const shutdown = async () => {
    server.close();
    await svc.store.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error(formatActionable(e));
  process.exit(1);
});
