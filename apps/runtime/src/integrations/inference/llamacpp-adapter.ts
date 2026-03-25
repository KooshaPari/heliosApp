import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { InferenceRequest, InferenceResponse, ModelInfo } from "../../types/inference.ts";
import type { InferenceEngine } from "./engine.ts";

export class LlamaCppInferenceEngine implements InferenceEngine {
  readonly id = "llamacpp";
  readonly name = "llama.cpp (CPU/GPU)";
  readonly type = "local" as const;
  private binaryPath: string;
  private modelDir: string;

  constructor(binaryPath = "./llama-cli/llama-cli", modelDir = "./llama-cli/models") {
    this.binaryPath = binaryPath;
    this.modelDir = modelDir;
  }

  async init(): Promise<void> {
    try {
      await access(this.binaryPath);
    } catch (e) {
      throw new Error(`llama.cpp init failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const prompt = request.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const args = [this.binaryPath, "-m", request.model, "-p", prompt, "--no-display-prompt"];
    if (request.maxTokens) {
      args.push("-n", String(request.maxTokens));
    }

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`llama.cpp inference failed: ${stderr}`);
    }

    return {
      content: output.trim(),
      model: request.model,
      tokenUsage: { input: 0, output: 0 },
      finishReason: "end_turn",
    };
  }

  async *inferStream(request: InferenceRequest): AsyncIterable<string> {
    const response = await this.infer(request);
    yield response.content;
  }

  async listModels(): Promise<ModelInfo[]> {
    // Scan model directory for .gguf files
    try {
      const models: ModelInfo[] = [];
      for (const path of await findGgufFiles(this.modelDir)) {
        const name =
          path
            .replace(/\.gguf$/, "")
            .split("/")
            .pop() ?? path;
        models.push({
          id: join(this.modelDir, path),
          name,
          contextWindow: 4096,
          providerId: "llamacpp",
        });
      }
      return models;
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<"healthy" | "degraded" | "unavailable"> {
    try {
      await access(this.binaryPath);
      return "healthy";
    } catch {
      return "unavailable";
    }
  }

  async terminate(): Promise<void> {}
}

async function findGgufFiles(rootDir: string, relativeDir = ""): Promise<string[]> {
  const dirPath = relativeDir === "" ? rootDir : join(rootDir, relativeDir);
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const entryRelativePath = relativeDir === "" ? entry.name : join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        return findGgufFiles(rootDir, entryRelativePath);
      }
      return entry.name.endsWith(".gguf") ? [entryRelativePath] : [];
    })
  );
  return files.flat();
}
