export interface InferenceProvider {
  id: string;
  name: string;
  type: "cloud" | "local";
  backend: "anthropic" | "mlx" | "vllm" | "llamacpp";
  endpoint?: string;
  models: ModelInfo[];
  status: "available" | "unavailable" | "degraded";
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  providerId: string;
}

export interface InferenceRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  stream?: boolean;
}

export interface InferenceResponse {
  content: string;
  model: string;
  tokenUsage: { input: number; output: number };
  finishReason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
}
