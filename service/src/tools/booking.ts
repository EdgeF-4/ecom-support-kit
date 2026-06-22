import type { BookingSlot, ToolResult } from "../types.js";

function formatWhen(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function makeCheckBooking(slots: BookingSlot[]) {
  return async function checkBooking(input: {
    topic?: string | null;
  }): Promise<ToolResult & { slots: BookingSlot[] }> {
    const topic = (input.topic || "").toLowerCase();
    const matching = slots.filter((s) => !topic || s.topic === topic);
    const use = (matching.length ? matching : slots).slice(0, 3);

    if (!use.length) {
      return {
        slots: [],
        reply:
          "I do not see open slots right now. Share your email and I will have our team reach out with options.",
      };
    }

    const human = use
      .map((s) => `${s.topic} on ${formatWhen(s.startsAt)} (${s.durationMin} min)`)
      .join("; ");

    return {
      slots: use,
      reply: `Here are the next available ${
        topic || "booking"
      } times: ${human}. Reply with the one you want and the email for the invite, and I will lock it in.`,
    };
  };
}
