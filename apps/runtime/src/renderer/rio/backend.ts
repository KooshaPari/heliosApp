/**
 * Rio renderer adapter — implements the RendererAdapter interface.
 *
 * Mirrors the structure of the ghostty backend (spec 011) and conforms
 * to the abstract contract defined in spec 010.
 */

import type { RenderSurface, RendererAdapter, RendererConfig, RendererState } from "../adapter.js";
import type { RendererCapabilities } from "../capabilities.js";
import type { RendererRegistry } from "../registry.js";
import { RioCapabilities } from "./capabilities.js";
import { RioFallbackController } from "./fallback_controller.js";
import { RioInputRelay } from "./input.js";
import { RioMetrics } from "./metrics.js";
import { RioProcess } from "./process.js";
import { RioSurface } from "./surface.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class FeatureFlagDisabledError extends Error {
  constructor() {
    super("Rio renderer is disabled by feature flag");
    this.name = "FeatureFlagDisabledError";
  }
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

export class RioBackend implements RendererAdapter {
  readonly id = "rio" as const;
  readonly version: string = "0.1.0";

  private _state: RendererState = "uninitialized";
  private _config: RendererConfig | undefined;
  private _process: RioProcess | undefined;
  private _surface: RioSurface | undefined;
  private _capabilities: RioCapabilities;
  private _metrics: RioMetrics;
  private _inputRelay: RioInputRelay;
  private _crashHandlers: Array<(error: Error) => void> = [];
  private _enabled = true;
  private _registry: RendererRegistry | undefined;

  private readonly _streamBindings = new Map<
    string,
    { reader: ReadableStreamDefaultReader<Uint8Array>; aborted: boolean }
  >();

  private readonly _fallbackController: RioFallbackController;

  constructor() {
    this._capabilities = new RioCapabilities();
    this._metrics = new RioMetrics();
    this._inputRelay = new RioInputRelay();
    this._fallbackController = new RioFallbackController({
      getRegistry: () => this._registry,
      setRegistry: registry => {
        this._registry = registry;
      },
      getConfig: () => this._config,
      getState: () => this._state,
      setState: state => {
        this._state = state;
      },
      getProcess: () => this._process,
      clearProcess: () => {
        this._process = undefined;
      },
      getSurface: () => this._surface,
      clearSurface: () => {
        if (this._surface) {
          this._surface.unbind();
          this._surface = undefined;
        }
      },
      stopMetrics: () => {
        this._metrics.stop();
      },
      getStreamBindings: () => this._streamBindings,
      clearStreamBindings: () => {
        this._streamBindings.clear();
      },
    });
  }

  // -----------------------------------------------------------------------
  // Registry binding (for fallback)
  // -----------------------------------------------------------------------

  /** Bind a registry reference so fallback can find ghostty. */
  setRegistry(registry: RendererRegistry): void {
    this._fallbackController.setRegistry(registry);
  }

  /** Get current crash count (for testing). */
  getCrashCount(): number {
    return this._fallbackController.getCrashCount();
  }

  /** Check if fallback is in progress. */
  isFallbackInProgress(): boolean {
    return this._fallbackController.isFallbackInProgress();
  }

  // -----------------------------------------------------------------------
  // Feature-flag guard
  // -----------------------------------------------------------------------

  /** Disable this backend (rejects all operations). */
  setDisabled(): void {
    this._enabled = false;
  }

  private guardEnabled(): void {
    if (!this._enabled) {
      throw new FeatureFlagDisabledError();
    }
  }

  // -----------------------------------------------------------------------
  // RendererAdapter implementation
  // -----------------------------------------------------------------------

  async init(config: RendererConfig): Promise<void> {
    this.guardEnabled();
    if (this._state !== "uninitialized" && this._state !== "errored") {
      // Idempotent: already initialised.
      if (this._state === "running" || this._state === "initializing") {
        return;
      }
    }

    this._state = "initializing";
    this._config = config;

    try {
      this._process = new RioProcess();
      this._capabilities.detect(config);
      this._state = "running";
    } catch (err) {
      this._state = "errored";
      throw err;
    }
  }

  async start(surface: RenderSurface): Promise<void> {
    this.guardEnabled();
    if (this._state !== "running" && this._state !== "initializing") {
      throw new Error(`Cannot start rio in state "${this._state}"`);
    }

    this._surface = new RioSurface();
    const pid = await this._process?.start({
      gpuAcceleration: this._config?.gpuAcceleration ?? false,
    });

    this._surface.bind(surface, pid.pid);

    // Set up crash detection forwarding with fallback.
    this._process?.onExit(code => {
      if (this._state === "running") {
        this._fallbackController.incrementCrashCount();
        const error = new Error(`Rio process exited unexpectedly with code ${code}`);
        this._state = "errored";

        // Notify crash handlers.
        for (const handler of this._crashHandlers) {
          try {
            handler(error);
          } catch {
            // crash handlers must not throw
          }
        }

        // Attempt automatic fallback to ghostty.
        this._fallbackController.attemptFallback(error).catch(() => {
          // fallback errors are already handled inside _attemptFallback
        });
      }
    });

    this._state = "running";
    this._metrics.start();
  }

  async stop(): Promise<void> {
    if (this._state === "stopped" || this._state === "uninitialized") {
      return; // idempotent
    }
    this._state = "stopping";

    this._metrics.stop();

    // Abort all stream bindings.
    for (const [_ptyId, binding] of this._streamBindings) {
      binding.aborted = true;
      try {
        binding.reader.cancel().catch(() => {});
      } catch {
        // ignore
      }
    }
    this._streamBindings.clear();

    // Release surface.
    if (this._surface) {
      this._surface.unbind();
      this._surface = undefined;
    }

    // Stop process.
    if (this._process) {
      await this._process.stop();
      this._process = undefined;
    }

    this._state = "stopped";
  }

  bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void {
    this.guardEnabled();
    // Replace existing binding.
    const existing = this._streamBindings.get(ptyId);
    if (existing) {
      existing.aborted = true;
      existing.reader.cancel().catch(() => {});
    }

    const reader = stream.getReader();
    const binding = { reader, aborted: false };
    this._streamBindings.set(ptyId, binding);

    // Pump loop — read from PTY stream, forward to rio process.
    const pump = async (): Promise<void> => {
      try {
        while (!binding.aborted) {
          const { done, value } = await reader.read();
          if (done || binding.aborted) {
            break;
          }
          if (value && this._process?.isRunning()) {
            this._process.writeToStdin(value);
          }
        }
      } catch {
        // Stream ended or errored — clean up.
      } finally {
        this._streamBindings.delete(ptyId);
      }
    };
    pump();
  }

  unbindStream(ptyId: string): void {
    const binding = this._streamBindings.get(ptyId);
    if (!binding) {
      return;
    }
    binding.aborted = true;
    binding.reader.cancel().catch(() => {});
    this._streamBindings.delete(ptyId);
  }

  handleInput(ptyId: string, data: Uint8Array): void {
    this.guardEnabled();
    this._inputRelay.relay(ptyId, data);
  }

  resize(_ptyId: string, cols: number, rows: number): void {
    this.guardEnabled();
    if (this._surface) {
      this._surface.resize({
        x: 0,
        y: 0,
        width: cols * 8, // approximate cell width
        height: rows * 16, // approximate cell height
      });
    }
  }

  queryCapabilities(): RendererCapabilities {
    return this._capabilities.get();
  }

  getState(): RendererState {
    return this._state;
  }

  onCrash(handler: (error: Error) => void): void {
    this._crashHandlers.push(handler);
  }

  async _attemptFallback(crashError: Error): Promise<void> {
    await this._fallbackController.attemptFallback(crashError);
  }

  // -----------------------------------------------------------------------
  // Metrics access
  // -----------------------------------------------------------------------

  getMetrics(): RioMetrics {
    return this._metrics;
  }

  // -----------------------------------------------------------------------
  // Re-enable support (for feature flag toggle)
  // -----------------------------------------------------------------------

  /** Re-enable this backend after it was disabled. */
  setEnabled(): void {
    this._enabled = true;
  }

  /** Check if the backend is enabled. */
  isEnabled(): boolean {
    return this._enabled;
  }
}
