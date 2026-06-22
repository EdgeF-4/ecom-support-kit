export interface LlmRequest {
  system: string;
  user: string;
  context?: string;
}

export interface LlmResponse {
  text: string;
  tokens: number;
}

export interface LlmAdapter {
  readonly callCount: number;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/**
 * Deterministic, offline stand in for a chat model. It never calls a network
 * or a paid provider. It composes a grounded reply strictly from the context
 * it is given, which is exactly the behavior we want from the real model: stay
 * inside the supported tasks and answer only from store data.
 *
 * It exposes a call counter so tests can prove that the answer cache prevents a
 * second, cost incurring call for a repeated question.
 */
export function createMockLlm(): LlmAdapter {
  let calls = 0;
  return {
    get callCount() {
      return calls;
    },
    async complete({ user, context }) {
      calls += 1;
      const grounding = (context || "").trim();
      const parts: string[] = ["Thanks for reaching out."];
      if (grounding) {
        parts.push("Here is what I found for you:");
        parts.push(grounding);
      } else {
        parts.push(
          "I can help with order status, returns, shipping, our FAQ, and booking. Could you share a little more detail?"
        );
      }
      parts.push("Is there anything else I can help with?");
      const text = parts.join("\n\n");
      // Rough token estimate, enough for usage reporting in the mock.
      const tokens = Math.ceil((user.length + text.length) / 4);
      return { text, tokens };
    },
  };
}
