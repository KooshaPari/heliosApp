export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface InferenceRequest {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface InferenceResponse {
  content: string;
  model: string;
  tokenUsage: TokenUsage;
  finishReason: "end_turn" | "max_tokens" | "stop_sequence";
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  providerId: string;
}
