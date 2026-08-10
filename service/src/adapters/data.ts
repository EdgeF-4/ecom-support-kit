import { readFileSync } from "node:fs";
import path from "node:path";
import type { StoreData } from "../types.js";
import { ActionableError } from "../errors.js";

interface MockClock {
  anchorDate: string;
}

function shiftDate(value: string | undefined, days: number): string | undefined {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? date.toISOString().slice(0, 10)
    : date.toISOString();
}

/**
 * Keep the bundled mock store coherent whenever the demo is run. The source
 * fixtures describe a timeline around an anchor day; this shifts that whole
 * timeline to today so "on its way" orders and "available" slots never point
 * into the past. Custom data directories without mock-clock.json are left
 * untouched.
 */
function rebaseMockDates(
  data: StoreData,
  clock: MockClock | null,
  now: Date
): StoreData {
  if (!clock) return data;
  const anchor = new Date(`${clock.anchorDate}T00:00:00Z`);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  if (Number.isNaN(anchor.valueOf())) return data;
  const days = Math.round((today - anchor.valueOf()) / 86_400_000);

  return {
    ...data,
    orders: data.orders.map((order) => ({
      ...order,
      placedAt: shiftDate(order.placedAt, days) ?? order.placedAt,
      eta: shiftDate(order.eta, days),
      deliveredAt: shiftDate(order.deliveredAt, days),
    })),
    booking: data.booking.map((slot) => ({
      ...slot,
      startsAt: shiftDate(slot.startsAt, days) ?? slot.startsAt,
    })),
  };
}

/**
 * Load the bundled mock store data from disk. A production Shopify adapter is
 * an explicit integration task and is not included in this repository.
 */
export function loadData(dataDir: string, now = new Date()): StoreData {
  const read = (name: string) => {
    const file = path.join(dataDir, name);
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      const missing = code === "ENOENT";
      throw new ActionableError(
        missing ? "DATA_FILE_MISSING" : "DATA_FILE_INVALID",
        missing
          ? `Cannot load the required mock data file ${file}.`
          : `Cannot parse the mock data file ${file}.`,
        missing
          ? "Restore service/data, or set DATA_DIR to a directory containing orders.json, products.json, faq.json, and booking.json."
          : "Fix the file as valid JSON, then run npm run demo again.",
        { cause: error }
      );
    }
  };
  const readClock = (): MockClock | null => {
    try {
      return read("mock-clock.json") as MockClock;
    } catch (error) {
      if (error instanceof ActionableError && error.code !== "DATA_FILE_MISSING") {
        throw error;
      }
      return null;
    }
  };
  const data: StoreData = {
    orders: read("orders.json"),
    products: read("products.json"),
    faq: read("faq.json"),
    booking: read("booking.json"),
  };
  return rebaseMockDates(data, readClock(), now);
}
