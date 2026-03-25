import type { RendererState } from "../adapter.js";
import type { GhosttyMetrics } from "./metrics.js";

type RenderEventHandler = (event: string, payload: unknown) => void;

export class GhosttyRenderLoopMonitor {
  private _stallCheckTimer: ReturnType<typeof setInterval> | undefined;
  private _lastFrameTimestamp = 0;
  private _fpsWindowStart = 0;
  private _fpsWindowFrames = 0;
  private _degradedStart = 0;
  private _targetFps = 60;
  private _fpsEventHandler: RenderEventHandler | undefined;

  constructor(
    private readonly metrics: GhosttyMetrics,
    private readonly getState: () => RendererState,
    private readonly isProcessRunning: () => boolean
  ) {}

  recordFrame(timestamp: number = Date.now()): void {
    this._lastFrameTimestamp = timestamp;
    this._fpsWindowFrames++;
    this.metrics.recordFrame(timestamp);

    const elapsed = timestamp - this._fpsWindowStart;
    if (elapsed >= 1_000) {
      const currentFps = (this._fpsWindowFrames / elapsed) * 1_000;
      this._checkFpsDegradation(currentFps, timestamp);
      this._fpsWindowStart = timestamp;
      this._fpsWindowFrames = 0;
    }
  }

  setTargetFps(fps: number): void {
    this._targetFps = fps;
  }

  onRenderEvent(handler: RenderEventHandler): void {
    this._fpsEventHandler = handler;
  }

  start(): void {
    this._fpsWindowStart = Date.now();
    this._fpsWindowFrames = 0;
    this._lastFrameTimestamp = Date.now();
    this._degradedStart = 0;

    this._stallCheckTimer = setInterval(() => {
      this._checkRenderStall();
    }, 500);
  }

  stop(): void {
    if (this._stallCheckTimer !== undefined) {
      clearInterval(this._stallCheckTimer);
      this._stallCheckTimer = undefined;
    }
  }

  private _checkFpsDegradation(currentFps: number, timestamp: number): void {
    const threshold = this._targetFps - 5;
    if (currentFps < threshold) {
      if (this._degradedStart === 0) {
        this._degradedStart = timestamp;
      } else if (timestamp - this._degradedStart > 2_000) {
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
    if (this.getState() !== "running") {
      return;
    }
    if (this._lastFrameTimestamp === 0) {
      return;
    }

    const elapsed = Date.now() - this._lastFrameTimestamp;
    if (elapsed > 500 && this.isProcessRunning()) {
    }
  }
}
