import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ActionableError,
  asActionable,
  formatActionable,
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
