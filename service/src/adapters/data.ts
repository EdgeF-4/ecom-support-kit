import { readFileSync } from "node:fs";
import path from "node:path";
import type { StoreData } from "../types.js";

/**
 * Load the mock store data from disk. Replace this with a real Shopify backed
 * loader to go live; nothing else in the kit needs to change.
 */
export function loadData(dataDir: string): StoreData {
  const read = (name: string) =>
    JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));
  return {
    orders: read("orders.json"),
    products: read("products.json"),
    faq: read("faq.json"),
    booking: read("booking.json"),
  };
}
