import type { RendererAdapter, RendererConfig, RendererState } from "../adapter.js";
import type { RendererRegistry } from "../registry.js";
import type { RioProcess } from "./process.js";
import type { RioSurface } from "./surface.js";

type StreamBinding = {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  aborted: boolean;
};

type RioFallbackHost = {
  getRegistry(): RendererRegistry | undefined;
  setRegistry(registry: RendererRegistry | undefined): void;
  getConfig(): RendererConfig | undefined;
  getState(): RendererState;
  setState(state: RendererState): void;
  getProcess(): RioProcess | undefined;
  clearProcess(): void;
  getSurface(): RioSurface | undefined;
  clearSurface(): void;
  stopMetrics(): void;
  getStreamBindings(): Map<string, StreamBinding>;
  clearStreamBindings(): void;
};

export class RioFallbackController {
  private static readonly FALLBACK_TIMEOUT_MS = 5000;
  private _fallbackInProgress = false;
  private _crashCount = 0;

  constructor(private readonly host: RioFallbackHost) {}

  setRegistry(registry: RendererRegistry): void {
    this.host.setRegistry(registry);
  }

  getCrashCount(): number {
    return this._crashCount;
  }

  isFallbackInProgress(): boolean {
    return this._fallbackInProgress;
  }

  incrementCrashCount(): void {
    this._crashCount += 1;
  }

  async attemptFallback(crashError: Error): Promise<void> {
    void crashError;

    if (this._fallbackInProgress) {
      return;
    }

    this._fallbackInProgress = true;

    try {
      const registry = this.host.getRegistry();
      if (!registry) {
        this.host.setState("errored");
        return;
      }

      const ghostty = registry.get("ghostty");
      if (!ghostty) {
        this.host.setState("errored");
        return;
      }

      const boundPtyIds = [...this.host.getStreamBindings().keys()];

      this.host.stopMetrics();
      for (const [, binding] of this.host.getStreamBindings()) {
        binding.aborted = true;
        try {
          binding.reader.cancel().catch(() => {});
        } catch {
          // ignore
        }
      }
      this.host.clearStreamBindings();
      if (this.host.getSurface()) {
        this.host.clearSurface();
      }
      if (this.host.getProcess()) {
        this.host.clearProcess();
      }

      const switchPromise = this.switchToGhostty(ghostty, boundPtyIds);
      const timeout = new Promise<"timeout">(resolve =>
        setTimeout(() => resolve("timeout"), RioFallbackController.FALLBACK_TIMEOUT_MS)
      );

      const result = await Promise.race([switchPromise, timeout]);
      if (result === "timeout") {
        this.host.setState("errored");
        return;
      }

      registry.setActive("ghostty");
      this.host.setState("stopped");
    } catch {
      this.host.setState("errored");
    } finally {
      this._fallbackInProgress = false;
    }
  }

  private async switchToGhostty(ghostty: RendererAdapter, _boundPtyIds: string[]): Promise<void> {
    const ghosttyState = ghostty.getState();
    if (
      ghosttyState === "uninitialized" ||
      ghosttyState === "stopped" ||
      ghosttyState === "errored"
    ) {
      const config: RendererConfig = this.host.getConfig() ?? {
        gpuAcceleration: false,
        colorDepth: 24,
        maxDimensions: { cols: 200, rows: 50 },
      };
      await ghostty.init(config);
    }
  }
}
