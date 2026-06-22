import type { Config } from "../config.js";
import type { Store } from "../store/index.js";
import type { ToolResult } from "../types.js";

export interface EscalationPlan {
  status: string;
  assignee: string;
  intent: string;
  reply: string;
}

/**
 * Pure helper that decides how an escalation should be recorded and worded.
 * Shared by the standalone escalate tool and by the pipeline, so the routing
 * behavior is defined in one place.
 */
export function buildEscalation(
  input: { intent?: string; reason?: string },
  config: Config
): EscalationPlan {
  const queue = config.escalation.queue;
  return {
    status: "escalated",
    assignee: queue,
    intent: input.intent || "human_handoff",
    reply: `I am connecting you with our team. I have logged your request and routed it to ${queue}. Someone will follow up by email shortly.`,
  };
}

export function makeEscalate(store: Store, config: Config) {
  return async function escalate(input: {
    message: string;
    email?: string | null;
    reason?: string;
    intent?: string;
  }): Promise<ToolResult & { ticketId: number; queue: string }> {
    const plan = buildEscalation(input, config);
    const { id } = await store.createTicket({
      message: input.message || "(no message)",
      customerEmail: input.email ?? null,
      channel: "web",
      intent: plan.intent,
      route: "escalate",
      status: plan.status,
      assignee: plan.assignee,
      reply: plan.reply,
      confidence: null,
      metadata: { reason: input.reason ?? "escalated" },
    });
    return {
      ticketId: id,
      queue: config.escalation.queue,
      reply: `${plan.reply} Your ticket reference is #${id}.`,
    };
  };
}
