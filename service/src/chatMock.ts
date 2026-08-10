import type { LlmAdapter } from "./adapters/llmMock.js";
import { ActionableError } from "./errors.js";
import type { ChatRequest } from "./chatContract.js";

/**
 * Provider-shaped chat endpoint backed by the deterministic offline model.
 * It exists only so workflow fixtures can be exercised without a paid call.
 */
export async function handleChatCompletion(llm: LlmAdapter, body: ChatRequest) {
  if (!Array.isArray(body?.messages)) {
    throw new ActionableError(
      "INVALID_CHAT_INPUT",
      "The messages field is missing or is not an array.",
      "Send a messages array containing at least one user message, then retry.",
      { status: 400 }
    );
  }
  const messages = body.messages;
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const user =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";

  if (!user.trim()) {
    throw new ActionableError(
      "INVALID_CHAT_INPUT",
      "The messages array has no non-empty user message.",
      "Add a user message with text content, then retry.",
      { status: 400 }
    );
  }

  const response = await llm.complete({ system, user, context: "" });
  const created = Math.floor(Date.now() / 1000);

  return {
    id: `chatcmpl-mock-${created}`,
    object: "chat.completion",
    created,
    model: body.model || "offline-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: response.text },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: Math.ceil(user.length / 4),
      completion_tokens: Math.ceil(response.text.length / 4),
      total_tokens: response.tokens,
    },
  };
}
