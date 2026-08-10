import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/adapters/data.js";
import { loadConfig } from "../src/config.js";
import { makeCheckBooking } from "../src/tools/booking.js";
import { ActionableError } from "../src/errors.js";

test("bundled mock dates stay coherent relative to the run date", () => {
  const now = new Date("2026-08-10T09:30:00Z");
  const data = loadData(loadConfig().dataDir, now);
  const shipped = data.orders.find((order) => order.id === "1001");

  assert.equal(shipped?.eta, "2026-08-12");
  assert.ok(data.booking.every((slot) => Date.parse(slot.startsAt) > now.valueOf()));
  assert.equal(data.booking[0].startsAt, "2026-08-12T15:00:00.000Z");
});

test("booking never advertises expired slots", async () => {
  const booking = makeCheckBooking(
    [
      {
        id: "past",
        topic: "fitting",
        startsAt: "2026-08-09T10:00:00Z",
        durationMin: 30,
      },
      {
        id: "future",
        topic: "fitting",
        startsAt: "2026-08-11T10:00:00Z",
        durationMin: 30,
      },
    ],
    () => new Date("2026-08-10T09:30:00Z")
  );

  const result = await booking({ topic: "fitting" });
  assert.deepEqual(result.slots.map((slot) => slot.id), ["future"]);
});

test("missing data names the files to restore", () => {
  assert.throws(
    () => loadData("/tmp/not-a-support-data-dir"),
    (error: unknown) => {
      assert.ok(error instanceof ActionableError);
      assert.equal(error.code, "DATA_FILE_MISSING");
      assert.match(error.next, /orders\.json/);
      assert.match(error.next, /DATA_DIR/);
      return true;
    }
  );
});
