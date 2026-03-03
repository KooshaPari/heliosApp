import type { InferenceRequest, InferenceResponse, ModelInfo } from "../../types/inference.ts";
import type { InferenceEngine } from "./engine.ts";

type AnthropicResponseContentBlock = { type?: string; text?: string };

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

  init(): Promise<void> {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key not configured. Set ANTHROPIC_API_KEY or HELIOS_ACP_API_KEY environment variable."
      );
    }
    return Promise.resolve();
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const payload: Record<string, unknown> = {
      model: request.model || "claude-sonnet-4-20250514",
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
    };
    payload.max_tokens = request.maxTokens ?? 4096;

    const response = await fetch(`${this.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const responsePayload = (await response.json()) as Record<string, unknown>;
    const usage =
      typeof responsePayload.usage === "object" && responsePayload.usage !== null
        ? (responsePayload.usage as Record<string, unknown>)
        : {};
    const stopReason = responsePayload.stop_reason;
    const isTextBlock = (value: unknown): value is AnthropicResponseContentBlock => {
      return (
        typeof value === "object" &&
        value !== null &&
        (value as { type?: unknown }).type === "text" &&
        typeof (value as { text?: unknown }).text === "string"
      );
    };

    const contentBlocks = Array.isArray(responsePayload.content) ? responsePayload.content : [];
    const content = contentBlocks
      .filter(isTextBlock)
      .map(block => String(block.text))
      .join("");

    return {
      content,
      model: typeof responsePayload.model === "string" ? responsePayload.model : request.model,
      tokenUsage: {
        input: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
        output: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
      },
      finishReason: stopReason === "end_turn" ? "end_turn" : "max_tokens",
    };
  }

  async *inferStream(request: InferenceRequest): AsyncIterable<string> {
    // Simplified: full response for now
    const response = await this.infer(request);
    yield response.content;
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve([
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
    ]);
  }

  async healthCheck(): Promise<"healthy" | "degraded" | "unavailable"> {
    if (!this.apiKey) {
      return "unavailable";
    }
    try {
      const payload: Record<string, unknown> = {
        model: "claude-haiku-4-20250514",
        messages: [{ role: "user", content: "hi" }],
      };
      payload.max_tokens = 1;

      const response = await fetch(`${this.endpoint}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
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
