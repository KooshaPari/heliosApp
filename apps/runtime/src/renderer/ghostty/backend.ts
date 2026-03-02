/**
 * Ghostty renderer adapter (T001).
 *
 * Implements the {@link RendererAdapter} interface from spec 010 for the
 * ghostty terminal emulator backend.
 */

import type { RenderSurface, RendererAdapter, RendererConfig, RendererState } from "../adapter.js";
import type { RendererCapabilities } from "../capabilities.js";
import { detectCapabilities, getCachedCapabilities } from "./capabilities.js";
import { GhosttyInputRelay } from "./input.js";
import type { PtyWriter } from "./input.js";
import { GhosttyMetrics } from "./metrics.js";
import type { MetricsPublisher, MetricsSnapshot } from "./metrics.js";
import { GhosttyProcess } from "./process.js";
import { GhosttySurface } from "./surface.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GhosttyNotInitializedError extends Error {
  constructor() {
    super("GhosttyBackend has not been initialized. Call init() first.");
    this.name = "GhosttyNotInitializedError";
  }
}

export class GhosttyNotRunningError extends Error {
  constructor() {
    super("GhosttyBackend is not running. Call start() first.");
    this.name = "GhosttyNotRunningError";
  }
}

export class GhosttyAlreadyInitializedError extends Error {
  constructor() {
    super("GhosttyBackend is already initialized. Call stop() before re-init.");
    this.name = "GhosttyAlreadyInitializedError";
  }
}

// ---------------------------------------------------------------------------
// Backend implementation
// ---------------------------------------------------------------------------

export class GhosttyBackend implements RendererAdapter {
  readonly id = "ghostty" as const;
  readonly version: string;

  private _state: RendererState = "uninitialized";
  private _config: RendererConfig | undefined;
  private readonly _process = new GhosttyProcess();
  private readonly _surface = new GhosttySurface();
  private readonly _streams = new Map<string, ReadableStreamDefaultReader<Uint8Array>>();
  private readonly _streamAbortControllers = new Map<string, AbortController>();
  private _crashHandler: ((error: Error) => void) | undefined;

  constructor(version = "0.0.0") {
    this.version = version;

    // Wire process crash events to the adapter crash handler
    this._process.onCrash(error => {
      this._state = "errored";
      this._crashHandler?.(error);
    });
  }

  // -------------------------------------------------------------------------
  // RendererAdapter implementation
  // -------------------------------------------------------------------------

  async init(config: RendererConfig): Promise<void> {
    if (this._state !== "uninitialized" && this._state !== "stopped" && this._state !== "errored") {
      throw new GhosttyAlreadyInitializedError();
    }

    this._state = "initializing";

    try {
      this._config = config;
      // Detect capabilities (GPU, etc.) during init
      await detectCapabilities(true);
      this._state = "running";
    } catch (error) {
      this._state = "errored";
      throw error;
    }
  }

  async start(surface: RenderSurface): Promise<void> {
    if (this._state !== "running") {
      throw new GhosttyNotInitializedError();
    }

    const { pid } = await this._process.start({
      windowId: surface.windowId,
    });

    this._surface.bind(surface, pid);
  }

  async stop(): Promise<void> {
    if (this._state === "stopped" || this._state === "uninitialized") {
      // Idempotent
      return;
    }

    this._state = "stopping";

    // Unbind all streams
    for (const ptyId of [...this._streams.keys()]) {
      this.unbindStream(ptyId);
    }

    // Unbind surface
    this._surface.unbind();

    // Stop process
    await this._process.stop();

    this._state = "stopped";
    this._config = undefined;
  }

  bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void {
    if (this._state !== "running") {
      throw new GhosttyNotRunningError();
    }

    // If already bound, unbind first (replace semantics)
    if (this._streams.has(ptyId)) {
      this.unbindStream(ptyId);
    }

    const controller = new AbortController();
    const reader = stream.getReader();
    this._streams.set(ptyId, reader);
    this._streamAbortControllers.set(ptyId, controller);

    // Start pump loop: read from PTY stream, feed to ghostty
    void this._pumpStream(ptyId, reader, controller.signal);
  }

  unbindStream(ptyId: string): void {
    const controller = this._streamAbortControllers.get(ptyId);
    if (controller !== undefined) {
      controller.abort();
      this._streamAbortControllers.delete(ptyId);
    }

    const reader = this._streams.get(ptyId);
    if (reader !== undefined) {
      void reader.cancel().catch(() => {
        // Stream may already be closed -- ignore
      });
      this._streams.delete(ptyId);
    }
  }

  handleInput(ptyId: string, data: Uint8Array): void {
    if (this._state !== "running") {
      throw new GhosttyNotRunningError();
    }

    // In a real integration this would relay raw bytes to the PTY
    // via the ghostty process IPC channel.
    // For now the adapter stores the intent; the PTY write path is
    // wired externally by the orchestration layer.
    void ptyId;
    void data;
  }

  resize(ptyId: string, cols: number, rows: number): void {
    if (this._state !== "running") {
      return; // Silently ignore resize when not running
    }

    // Notify ghostty of the terminal dimension change.
    // In a full integration this would send a resize IPC message
    // targeting the specific PTY pane.
    void ptyId;
    void cols;
    void rows;

    // Also resize the surface if applicable
    if (this._surface.isBound()) {
      const current = this._surface.getSurface();
      if (current !== undefined) {
        this._surface.resize(current.bounds);
      }
    }
  }

  queryCapabilities(): RendererCapabilities {
    return getCachedCapabilities();
  }

  getState(): RendererState {
    return this._state;
  }

  onCrash(handler: (error: Error) => void): void {
    this._crashHandler = handler;
  }

  // -------------------------------------------------------------------------
  // Internal: render loop monitoring (T006)
  // -------------------------------------------------------------------------

  private _startRenderLoopMonitoring(): void {
    this._fpsWindowStart = Date.now();
    this._fpsWindowFrames = 0;
    this._lastFrameTimestamp = Date.now();
    this._degradedStart = 0;

    // Stall check every 500ms
    this._stallCheckTimer = setInterval(() => {
      this._checkRenderStall();
    }, 500);
  }

  private _stopRenderLoopMonitoring(): void {
    if (this._stallCheckTimer !== undefined) {
      clearInterval(this._stallCheckTimer);
      this._stallCheckTimer = undefined;
    }
    if (this._renderLoopTimer !== undefined) {
      clearInterval(this._renderLoopTimer);
      this._renderLoopTimer = undefined;
    }
  }

  private _checkFpsDegradation(currentFps: number, timestamp: number): void {
    const threshold = this._targetFps - 5; // < 55 FPS
    if (currentFps < threshold) {
      if (this._degradedStart === 0) {
        this._degradedStart = timestamp;
      } else if (timestamp - this._degradedStart > 2_000) {
        // Sustained degradation for > 2 seconds
        this._fpsEventHandler?.("renderer.ghostty.fps_degraded", {
          currentFps: Math.round(currentFps * 100) / 100,
          targetFps: this._targetFps,
          degradedForMs: timestamp - this._degradedStart,
          timestamp,
        });
      }
    } else {
      this._degradedStart = 0;
    }
  }

  private _checkRenderStall(): void {
    if (this._state !== "running") {
      return;
    }
    if (this._lastFrameTimestamp === 0) {
      return;
    }

    const elapsed = Date.now() - this._lastFrameTimestamp;
    if (elapsed > 500) {
      // Check if the process is alive
      if (this._process.isRunning()) {
      }
      // If process is dead, crash detection in WP01 T002 handles it.
    }
  }

  // -------------------------------------------------------------------------
  // Internal: stream pump
  // -------------------------------------------------------------------------

  /**
   * Continuously read from a PTY stream and feed data to ghostty.
   */
  private async _pumpStream(
    ptyId: string,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal
  ): Promise<void> {
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        // In a real integration this would write `value` to the
        // ghostty process stdin for the given PTY.
        void ptyId;
        void value;
      }
    } catch {
      // Stream cancelled or aborted -- expected during unbind
    }
  }
}
