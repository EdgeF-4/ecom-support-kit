import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { ActionableError } from "../src/errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const invalidConfig = path.resolve(
  here,
  "..",
  "..",
  "test",
  "fixtures",
  "invalid-config.json"
);

async function withEnv(
  values: Record<string, string | undefined>,
  run: () => void | Promise<void>
): Promise<void> {
  const before = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("invalid JSON config reports the fix", async () => {
  await withEnv({ SUPPORT_CONFIG: invalidConfig }, () => {
    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        assert.ok(error instanceof ActionableError);
        assert.equal(error.code, "CONFIG_PARSE_FAILED");
        assert.match(error.next, /Fix its JSON syntax/);
        assert.match(error.next, /npm run demo/);
        return true;
      }
    );
  });
});

test("an explicit missing config path does not silently use defaults", async () => {
  await withEnv(
    { SUPPORT_CONFIG: "/tmp/not-an-ecom-support-config.json" },
    () => {
      assert.throws(
        () => loadConfig(),
        (error: unknown) => {
          assert.ok(error instanceof ActionableError);
          assert.equal(error.code, "CONFIG_FILE_MISSING");
          assert.match(error.next, /Fix SUPPORT_CONFIG/);
          assert.match(error.next, /unset it/);
          return true;
        }
      );
    }
  );
});

test("invalid port reports the accepted range and an example", async () => {
  await withEnv({ SUPPORT_CONFIG: undefined, PORT: "not-a-port" }, () => {
    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        assert.ok(error instanceof ActionableError);
        assert.equal(error.code, "CONFIG_INVALID");
        assert.match(error.message, /outside 1 to 65535/);
        assert.match(error.next, /8080/);
        return true;
      }
    );
  });
});

test("unsupported adapters stop instead of silently falling back", async () => {
  await withEnv(
    { SUPPORT_CONFIG: undefined, STORE_DRIVER: "remote", LLM_DRIVER: undefined },
    () => {
      assert.throws(
        () => loadConfig(),
        (error: unknown) => {
          assert.ok(error instanceof ActionableError);
          assert.equal(error.code, "CONFIG_INVALID");
          assert.match(error.next, /memory/);
          assert.match(error.next, /postgres/);
          return true;
        }
      );
    }
  );
});
