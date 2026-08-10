export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages?: ChatMessage[];
}
