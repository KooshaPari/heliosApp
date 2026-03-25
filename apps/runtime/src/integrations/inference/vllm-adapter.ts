import type {
	InferenceRequest,
	InferenceResponse,
	ModelInfo,
} from "../../types/inference";
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

		const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				model: request.model,
				messages: request.messages,
				max_tokens: request.maxTokens ?? 4096,
				stream: false,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`vLLM error (${response.status}): ${await response.text()}`,
			);
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string }; finish_reason: string }>;
			model: string;
			usage: { prompt_tokens: number; completion_tokens: number };
		};

		return {
			content: data.choices[0]?.message.content ?? "",
			model: data.model,
			tokenUsage: {
				input: data.usage.prompt_tokens,
				output: data.usage.completion_tokens,
			},
			finishReason:
				data.choices[0]?.finish_reason === "stop" ? "end_turn" : "max_tokens",
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
			return data.data.map((m) => ({
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

	async terminate(): Promise<void> {}
}
