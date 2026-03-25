import type { ACPConfig, ACPExecuteInput } from "../adapter.js";

export type ACPRequest = {
  correlationId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
};

export type ACPResponse = {
  taskId: string;
  content: string;
  stopReason: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

export function buildACPRequest(
  config: ACPConfig,
  input: ACPExecuteInput,
  correlationId: string
): ACPRequest {
  return {
    correlationId,
    model: config.model,
    messages: [
      {
        role: "user",
        content: input.prompt,
      },
    ],
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  };
}

export async function sendACPRequest(
  request: ACPRequest,
  signal: AbortSignal
): Promise<ACPResponse> {
  if (signal.aborted) {
    const abortError = new Error("Request aborted");
    abortError.name = "AbortError";
    throw abortError;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve({
        taskId: `task-${request.correlationId}`,
        content: "This is a mock ACP response.",
        stopReason: "end_turn",
        usage: {
          inputTokens: 10,
          outputTokens: 20,
        },
      });
    }, 10);

    const onAbort = () => {
      clearTimeout(timeout);
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      reject(abortError);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
