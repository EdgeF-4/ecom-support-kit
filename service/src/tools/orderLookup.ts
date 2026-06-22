import type { ShopifyAdapter } from "../adapters/shopifyMock.js";
import type { Order, ToolResult } from "../types.js";

function formatOrder(o: Order): string {
  const items = o.items.map((i) => `${i.qty} x ${i.title}`).join(", ");
  switch (o.fulfillment) {
    case "delivered":
      return `Order #${o.id} (${items}) was delivered${
        o.deliveredAt ? " on " + o.deliveredAt : ""
      }. If anything is not right, let me know and I can help with a return or replacement.`;
    case "shipped":
      return `Order #${o.id} (${items}) is on its way${
        o.carrier ? " via " + o.carrier : ""
      }. Tracking number ${o.tracking}.${
        o.eta ? " Estimated delivery " + o.eta + "." : ""
      }`;
    case "returned":
      return `Order #${o.id} (${items}) has been returned and a refund of ${o.total} was issued to your original payment method.`;
    default:
      return `Order #${o.id} (${items}) is confirmed and being prepared for shipment. You will get a tracking link by email as soon as it ships.`;
  }
}

export function makeOrderLookup(shopify: ShopifyAdapter) {
  return async function orderLookup(input: {
    orderId?: string | null;
    email?: string | null;
  }): Promise<ToolResult & { found: boolean; order?: Order }> {
    const orderId = input.orderId || undefined;
    const email = input.email || undefined;

    if (!orderId && !email) {
      return {
        found: false,
        reply:
          "Happy to check on your order. Could you share your order number, it looks like #1001, or the email you used at checkout?",
      };
    }

    const order = await shopify.findOrder({ orderId, email });
    if (!order) {
      return {
        found: false,
        reply: `I could not find an order matching ${
          orderId ? "number " + orderId : "that email"
        }. Please double check the details, or I can connect you with our team.`,
      };
    }

    return { found: true, order, reply: formatOrder(order) };
  };
}
