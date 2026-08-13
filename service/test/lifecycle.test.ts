import { test } from "node:test";
import assert from "node:assert/strict";
import { closeRuntime } from "../src/lifecycle.js";
import { formatActionable } from "../src/errors.js";

test("shutdown closes the store even when the server close fails", async () => {
  let storeClosed = false;
  const failure = await closeRuntime(
    {
      close(callback) {
        callback(new Error("private server detail"));
      },
    },
    {
      async close() {
        storeClosed = true;
      },
    }
  );

  assert.equal(storeClosed, true);
  assert.ok(failure);
  assert.equal(failure.code, "SHUTDOWN_FAILED");
  assert.match(failure.next, /check the store connection/);
  assert.doesNotMatch(formatActionable(failure), /private server detail/);
});

test("clean shutdown reports no failure", async () => {
  const failure = await closeRuntime(
    { close: (callback) => callback() },
    { close: async () => undefined }
  );
  assert.equal(failure, null);
});
