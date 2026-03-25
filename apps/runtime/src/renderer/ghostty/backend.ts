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
import { GhosttyRenderLoopMonitor } from "./render_loop.js";
import { GhosttyStreamManager } from "./streams.js";
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
  private _crashHandler: ((error: Error) => void) | undefined;

  private readonly _metrics = new GhosttyMetrics();
  private _inputRelay: GhosttyInputRelay | undefined;
  private readonly _renderMonitor: GhosttyRenderLoopMonitor;
  private readonly _streamManager: GhosttyStreamManager;

  constructor(version = "0.0.0") {
    this.version = version;
    this._renderMonitor = new GhosttyRenderLoopMonitor(
      this._metrics,
      () => this._state,
      () => this._process.isRunning()
    );
    this._streamManager = new GhosttyStreamManager(
      this._surface,
      this._writeToGhostty.bind(this),
      this._notifyStreamEnd.bind(this),
      this._notifyPaneRemoved.bind(this)
    );

    // Wire process crash events to the adapter crash handler
    this._process.onCrash(error => {
      this._state = "errored";
      this._crashHandler?.(error);
    });
  }

  // -------------------------------------------------------------------------
  // WP02 public API: Metrics (T008/T009)
  // -------------------------------------------------------------------------

  /** Access the metrics collector for this backend. */
  getMetrics(): GhosttyMetrics {
    return this._metrics;
  }

  /**
   * Enable metrics collection and optional publishing.
   */
  enableMetrics(publisher?: MetricsPublisher | undefined): void {
    if (publisher !== undefined) {
      this._metrics.setPublisher(publisher);
    }
    this._metrics.enable();
  }

  /**
   * Disable metrics collection and publishing.
   */
  disableMetrics(): void {
    this._metrics.disable();
  }

  /**
   * Get a snapshot of current metrics.
   */
  getMetricsSnapshot(): MetricsSnapshot {
    return this._metrics.getSnapshot();
  }

  // -------------------------------------------------------------------------
  // WP02 public API: Input relay (T007)
  // -------------------------------------------------------------------------

  /**
   * Set up an input relay backed by the given PTY writer.
   */
  setupInputRelay(ptyWriter: PtyWriter): GhosttyInputRelay {
    this._inputRelay = new GhosttyInputRelay(ptyWriter, this._metrics);
    return this._inputRelay;
  }

  /**
   * Get the current input relay, if set up.
   */
  getInputRelay(): GhosttyInputRelay | undefined {
    return this._inputRelay;
  }

  // -------------------------------------------------------------------------
  // WP02 public API: Render loop (T006)
  // -------------------------------------------------------------------------

  /**
   * Record a frame from the ghostty render loop.
   * Call this whenever ghostty completes a frame (via IPC signal, shared
   * memory fence, or output parsing).
   */
  recordFrame(timestamp: number = Date.now()): void {
    this._renderMonitor.recordFrame(timestamp);
  }

  /**
   * Set the target FPS (default 60). Used for degradation detection.
   */
  setTargetFps(fps: number): void {
    this._renderMonitor.setTargetFps(fps);
  }

  /**
   * Register an event handler for render-loop events
   * (e.g., `renderer.ghostty.fps_degraded`).
   */
  onRenderEvent(handler: (event: string, payload: unknown) => void): void {
    this._renderMonitor.onRenderEvent(handler);
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

      // Start render loop monitoring (T006)
      this._renderMonitor.start();
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

    // Stop render loop monitoring
    this._renderMonitor.stop();

    // Disable metrics
    this._metrics.disable();
    this._metrics.reset();

    // Tear down input relay
    this._inputRelay?.teardownAll();
    this._inputRelay = undefined;

    // Unbind all streams
    this._streamManager.teardownAll();

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
    this._streamManager.bindStream(ptyId, stream);
  }

  unbindStream(ptyId: string): void {
    this._streamManager.unbindStream(ptyId);
  }

  /**
   * Return the number of currently bound PTY streams.
   */
  getBoundStreamCount(): number {
    return this._streamManager.getBoundStreamCount();
  }

  /**
   * Return the IDs of all currently bound PTY streams.
   */
  getBoundStreamIds(): string[] {
    return this._streamManager.getBoundStreamIds();
  }

  /**
   * Return piping latency samples for a given PTY (T010).
   * Each value is the time in ms from stream read to ghostty write.
   */
  getPipingLatencies(ptyId: string): readonly number[] {
    return this._streamManager.getPipingLatencies(ptyId);
  }

  handleInput(ptyId: string, data: Uint8Array): void {
    if (this._state !== "running") {
      throw new GhosttyNotRunningError();
    }
    this._streamManager.handleInput(ptyId, data);
  }

  resize(ptyId: string, cols: number, rows: number): void {
    if (this._state !== "running") {
      return; // Silently ignore resize when not running
    }
    this._streamManager.resize(ptyId, cols, rows);
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

  private async _writeToGhostty(_ptyId: string, _data: Uint8Array): Promise<void> {
    return;
  }

  private _notifyStreamEnd(_ptyId: string): void {}

  private _notifyPaneRemoved(_ptyId: string): void {}
}
