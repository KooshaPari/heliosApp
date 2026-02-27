/**
 * Abstract renderer adapter interface.
 *
 * All renderer backends (ghostty, rio, etc.) must implement this contract.
 * This file contains only interface and type definitions -- no concrete
 * implementation.
 */

import type { RendererCapabilities } from "./capabilities.js";

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Configuration supplied to a renderer adapter at initialisation time.
 */
export interface RendererConfig {
  /** Whether the adapter should attempt GPU-accelerated rendering. */
  gpuAcceleration: boolean;
  /** Requested colour depth in bits (8, 16, or 24). */
  colorDepth: number;
  /** Maximum terminal dimensions the adapter needs to support. */
  maxDimensions: { cols: number; rows: number };
}

/**
 * Describes the surface (window region) a renderer should draw into.
 */
export interface RenderSurface {
  /** Unique identifier of the host window. */
  windowId: string;
  /** Pixel-space bounding box of the rendering area. */
  bounds: { x: number; y: number; width: number; height: number };
}

// ---------------------------------------------------------------------------
// Renderer state
// ---------------------------------------------------------------------------

/**
 * Possible lifecycle states of a renderer adapter.
 */
export type RendererState =
  | "uninitialized"
  | "initializing"
  | "running"
  | "switching"
  | "stopping"
  | "stopped"
  | "errored";

// ---------------------------------------------------------------------------
// Abstract adapter interface
// ---------------------------------------------------------------------------

/**
 * Contract that every renderer backend must implement.
 */
export interface RendererAdapter {
  readonly id: string;
  readonly version: string;

  init(config: RendererConfig): Promise<void>;
  start(surface: RenderSurface): Promise<void>;
  stop(): Promise<void>;

  bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void;
  unbindStream(ptyId: string): void;
  handleInput(ptyId: string, data: Uint8Array): void;
  resize(ptyId: string, cols: number, rows: number): void;

  queryCapabilities(): RendererCapabilities;
  getState(): RendererState;
  onCrash(handler: (error: Error) => void): void;
}
