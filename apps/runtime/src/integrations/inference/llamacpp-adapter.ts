import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
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
      await access(this.binaryPath, constants.X_OK);
      await access(this.modelDir, constants.R_OK);
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
    try {
      const modelPaths = await this.collectModelsFromDirectory(this.modelDir);
      return modelPaths.map(modelPath => {
        const name =
          modelPath
            .replace(/\.gguf$/, "")
            .split("/")
            .pop() ?? modelPath;
        return {
          id: `${this.modelDir}/${modelPath}`,
          name,
          contextWindow: 4096,
          providerId: "llamacpp",
        };
      });
    } catch {
      return [];
    }
  }

  private async collectModelsFromDirectory(
    baseDir: string,
    currentDir = baseDir
  ): Promise<string[]> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const models: string[] = [];

    for (const entry of entries) {
      const entryPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        const nested = await this.collectModelsFromDirectory(baseDir, entryPath);
        models.push(...nested);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".gguf")) {
        models.push(relative(baseDir, entryPath));
      }
    }

    return models;
  }

  async healthCheck(): Promise<"healthy" | "degraded" | "unavailable"> {
    try {
      await access(this.binaryPath, constants.X_OK);
      return "healthy";
    } catch {
      return "unavailable";
    }
  }

  terminate(): Promise<void> {
    return Promise.resolve();
  }
}
