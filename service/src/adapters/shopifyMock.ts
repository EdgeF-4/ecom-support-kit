import type { Order, Product, StoreData } from "../types.js";

export interface ShopifyAdapter {
  findOrder(opts: { orderId?: string; email?: string }): Promise<Order | null>;
  listProducts(): Promise<Product[]>;
}

function normalizeId(id: string): string {
  return id.replace(/[#\s]/g, "").toLowerCase();
}

/**
 * Offline stand in for the Shopify Admin API. It reads from local data and
 * makes no network calls, so the kit runs with no store credentials. The
 * interface mirrors what a real adapter would expose, so swapping it in later
 * is a drop in change.
 */
export function createMockShopify(data: StoreData): ShopifyAdapter {
  const byId = new Map(data.orders.map((o) => [normalizeId(o.id), o]));

  return {
    async findOrder({ orderId, email }) {
      if (orderId) {
        const hit = byId.get(normalizeId(orderId));
        if (hit) return hit;
      }
      if (email) {
        const matches = data.orders.filter(
          (o) => o.email.toLowerCase() === email.trim().toLowerCase()
        );
        if (matches.length) {
          // Most recently placed order for that email.
          return [...matches].sort((a, b) =>
            b.placedAt.localeCompare(a.placedAt)
          )[0];
        }
      }
      return null;
    },
    async listProducts() {
      return data.products;
    },
  };
}
