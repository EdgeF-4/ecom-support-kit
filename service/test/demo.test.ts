import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(here, "..", "..");
const repoRoot = path.resolve(serviceRoot, "..");

test("offline demo entrypoint covers routes, caching, and tickets", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      path.join(serviceRoot, "dist", "src", "demo.js"),
      path.join(repoRoot, "demo", "sample_data"),
      path.join(repoRoot, "demo", "sample_messages.json"),
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        SUPPORT_CONFIG: path.join(repoRoot, "demo", "no-config.json"),
        STORE_DRIVER: "memory",
        LLM_DRIVER: "mock",
      },
      timeout: 20_000,
    }
  );

  assert.equal(stderr, "");
  assert.match(stdout, /No credentials, containers, paid calls, or network access/);
  assert.match(stdout, /route=deterministic/);
  assert.match(stdout, /route=model/);
  assert.match(stdout, /route=escalate/);
  assert.match(stdout, /route=out_of_scope/);
  assert.match(stdout, /served from cache: true/);
  assert.match(stdout, /model calls total: 1/);
  assert.match(stdout, /tickets persisted: 7/);
  assert.match(stdout, /deterministic=3, model=1, escalate=1, out_of_scope=1/);
});
