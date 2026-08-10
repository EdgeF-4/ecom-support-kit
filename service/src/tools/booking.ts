import type { BookingSlot, ToolResult } from "../types.js";

function formatWhen(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function makeCheckBooking(
  slots: BookingSlot[],
  now: () => Date = () => new Date()
) {
  return async function checkBooking(input: {
    topic?: string | null;
  }): Promise<ToolResult & { slots: BookingSlot[] }> {
    const topic = (input.topic || "").toLowerCase();
    const future = slots.filter((s) => Date.parse(s.startsAt) > now().valueOf());
    const matching = future.filter((s) => !topic || s.topic === topic);
    const use = (matching.length ? matching : future).slice(0, 3);

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
      } times: ${human}. Choose a slot in your booking system to reserve it; this kit only checks availability.`,
    };
  };
}
