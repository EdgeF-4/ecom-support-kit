import { loadConfig } from "./config.js";
import { createServices } from "./services.js";
import { createServer } from "./server.js";
import {
  formatActionable,
  listenFailure,
  runtimeServerFailure,
} from "./errors.js";
import { closeRuntime } from "./lifecycle.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const svc = await createServices(config);
  const server = createServer(svc);

  await new Promise<void>((resolve, reject) => {
    const startupError = (error: Error) => {
      reject(listenFailure(error, config.service.host, config.service.port));
    };
    server.once("error", startupError);
    server.listen(config.service.port, config.service.host, () => {
      server.off("error", startupError);
      resolve();
    });
  });
  server.on("error", (error) => {
    console.error(formatActionable(runtimeServerFailure(error)));
    process.exitCode = 1;
  });
  console.log(
    `tool service listening on ${config.service.host}:${config.service.port} ` +
      `(store=${config.store.driver}, model=${config.llm.driver})`
  );

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const failure = await closeRuntime(server, svc.store);
    if (failure) {
      console.error(formatActionable(failure));
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

main().catch((e) => {
  console.error(formatActionable(e));
  process.exit(1);
});
