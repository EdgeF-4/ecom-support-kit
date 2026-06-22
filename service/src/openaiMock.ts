import type { LlmAdapter } from "./adapters/llmMock.js";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  model?: string;
  messages?: ChatMessage[];
}

/**
 * OpenAI compatible chat completions endpoint backed by the offline mock model.
 * The n8n chat model node points its base URL here, so the workflow runs with
 * no real provider and no API cost. Swap the base URL in config to go live.
 */
export async function handleChatCompletion(llm: LlmAdapter, body: ChatRequest) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const user =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";

  const res = await llm.complete({ system, user, context: "" });
  const created = Math.floor(Date.now() / 1000);

  return {
    id: `chatcmpl-mock-${created}`,
    object: "chat.completion",
    created,
    model: body?.model || "your-model-name",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: res.text },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: Math.ceil(user.length / 4),
      completion_tokens: Math.ceil(res.text.length / 4),
      total_tokens: res.tokens,
    },
  };
}
