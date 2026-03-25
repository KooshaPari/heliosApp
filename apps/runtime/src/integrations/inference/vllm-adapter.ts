import type { InferenceRequest, InferenceResponse, ModelInfo } from "../../types/inference";
import type { InferenceEngine } from "./engine";

export class VllmInferenceEngine implements InferenceEngine {
  readonly id = "vllm";
  readonly name = "vLLM (GPU Server)";
  readonly type = "server" as const;
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint = "http://localhost:8000", apiKey = "") {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  async init(): Promise<void> {
    const health = await this.healthCheck();
    if (health === "unavailable") {
      throw new Error(`vLLM server at ${this.endpoint} is not reachable`);
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: false,
    };
    body.max_tokens = request.maxTokens ?? 4096;

    const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`vLLM error (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const choices = payload.choices;
    const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
    const firstChoiceRecord =
      firstChoice && typeof firstChoice === "object"
        ? (firstChoice as Record<string, unknown>)
        : {};
    const message = firstChoiceRecord.message;
    const usage =
      typeof payload.usage === "object" && payload.usage !== null
        ? (payload.usage as Record<string, unknown>)
        : {};

    const messageRecord =
      typeof message === "object" && message !== null ? (message as Record<string, unknown>) : {};
    const content = typeof messageRecord.content === "string" ? messageRecord.content : "";
    const model = typeof payload.model === "string" ? payload.model : request.model;
    const input = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const output = typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0;
    const finishReason = firstChoiceRecord.finish_reason === "stop" ? "end_turn" : "max_tokens";

    return {
      content: data.choices[0]?.message.content ?? "",
      model: data.model,
      tokenUsage: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
      },
      finishReason: data.choices[0]?.finish_reason === "stop" ? "end_turn" : "max_tokens",
    };
  }

  async *inferStream(request: InferenceRequest): AsyncIterable<string> {
    const response = await this.infer(request);
    yield response.content;
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
      const response = await fetch(`${this.endpoint}/v1/models`, { headers });
      if (!response.ok) return [];
      const data = (await response.json()) as { data: Array<{ id: string }> };
      return data.data.map(m => ({
        id: m.id,
        name: m.id,
        contextWindow: 4096,
        providerId: "vllm",
      }));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<"healthy" | "degraded" | "unavailable"> {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok ? "healthy" : "degraded";
    } catch {
      return "unavailable";
    }
  }

  terminate(): Promise<void> {
    return Promise.resolve();
  }
}
