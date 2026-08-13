import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ActionableError,
  asActionable,
  formatActionable,
  listenFailure,
  runtimeServerFailure,
  toProblem,
} from "../src/errors.js";

test("actionable errors preserve a stable code and next action", () => {
  const error = new ActionableError(
    "EXAMPLE_FAILURE",
    "The example failed.",
    "Run the example check again.",
    { status: 409 }
  );
  assert.deepEqual(toProblem(error), {
    error: "EXAMPLE_FAILURE",
    message: "The example failed.",
    next: "Run the example check again.",
    status: 409,
  });
  assert.equal(
    formatActionable(error),
    "[EXAMPLE_FAILURE] The example failed. Next: Run the example check again."
  );
});

test("unknown failures become safe instructions instead of raw internals", () => {
  const error = asActionable(new Error("private implementation detail"), {
    error: "OPERATION_FAILED",
    message: "The operation failed.",
    next: "Retry once, then inspect the service log.",
  });
  assert.equal(error.code, "OPERATION_FAILED");
  assert.doesNotMatch(formatActionable(error), /private implementation detail/);
  assert.match(formatActionable(error), /Next:/);
});

test("listen failures prescribe the recovery for their failure class", () => {
  const busy = formatActionable(
    listenFailure({ code: "EADDRINUSE" }, "127.0.0.1", 8080)
  );
  const badHost = formatActionable(
    listenFailure({ code: "EAI_AGAIN" }, "bad-host", 8080)
  );
  const unknown = formatActionable(
    listenFailure(new Error("private detail"), "127.0.0.1", 8080)
  );

  assert.match(busy, /port 8080.*PORT=8081 npm start/);
  assert.match(badHost, /SERVICE_HOST=127\.0\.0\.1/);
  assert.match(unknown, /Check SERVICE_HOST, PORT, and local socket permissions/);
  assert.doesNotMatch(busy + badHost + unknown, /private detail/);
});

test("a runtime server error is bounded and tells the operator what to run", () => {
  const output = formatActionable(
    runtimeServerFailure(
      Object.assign(new Error("private detail"), { code: "EIO" })
    )
  );
  assert.match(output, /\[SERVER_ERROR\]/);
  assert.match(output, /\(EIO\)/);
  assert.match(output, /restart npm start/);
  assert.match(output, /npm run verify/);
  assert.doesNotMatch(output, /private detail/);
});
