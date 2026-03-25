import type { InferenceRequest, InferenceResponse, ModelInfo } from "../../types/inference";
import type { InferenceEngine } from "./engine";

export class AnthropicInferenceEngine implements InferenceEngine {
  readonly id = "anthropic";
  readonly name = "Anthropic (Cloud)";
  readonly type = "cloud" as const;
  private endpoint: string;
  private apiKey: string;

  constructor(apiKey?: string, endpoint = "https://api.anthropic.com") {
    this.apiKey = apiKey ?? process.env.HELIOS_ACP_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.endpoint = endpoint;
  }

  async init(): Promise<void> {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key not configured. Set ANTHROPIC_API_KEY or HELIOS_ACP_API_KEY environment variable."
      );
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const response = await fetch(`${this.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model || "claude-sonnet-4-20250514",
        max_tokens: request.maxTokens ?? 4096,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const content = data.content
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("");

    return {
      content,
      model: data.model,
      tokenUsage: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
      },
      finishReason: data.stop_reason === "end_turn" ? "end_turn" : "max_tokens",
    };
  }

  async *inferStream(request: InferenceRequest): AsyncIterable<string> {
    // Simplified: full response for now
    const response = await this.infer(request);
    yield response.content;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
        providerId: "anthropic",
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        contextWindow: 200000,
        providerId: "anthropic",
      },
      {
        id: "claude-haiku-4-20250514",
        name: "Claude Haiku 4",
        contextWindow: 200000,
        providerId: "anthropic",
      },
    ];
  }

  async healthCheck(): Promise<"healthy" | "degraded" | "unavailable"> {
    if (!this.apiKey) return "unavailable";
    try {
      const response = await fetch(`${this.endpoint}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      return response.ok ? "healthy" : "degraded";
    } catch {
      return "unavailable";
    }
  }

  async terminate(): Promise<void> {}
}
