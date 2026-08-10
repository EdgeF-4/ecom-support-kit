import { readFileSync } from "node:fs";
import path from "node:path";
import type { StoreData } from "../types.js";

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
  const read = (name: string) =>
    JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));
  const readClock = (): MockClock | null => {
    try {
      return read("mock-clock.json") as MockClock;
    } catch {
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
