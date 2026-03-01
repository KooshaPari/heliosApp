/**
 * Abstract renderer adapter interface.
 *
 * All renderer backends (ghostty, rio, etc.) must implement this contract.
 * This file contains only interface and type definitions — no concrete
 * implementation.
 */

import type { RendererCapabilities } from "./capabilities.js";

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Configuration supplied to a renderer adapter at initialisation time.
 *
 * @remarks
 * The adapter may ignore fields it does not support, but it must not
 * throw if an unsupported field is present. Unsupported capabilities
 * should be reflected in {@link RendererCapabilities}.
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
 *
 * @see {@link RendererStateMachine} for the transition table.
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
 *
 * Lifecycle flow:
 * 1. `init(config)` — allocate resources, detect capabilities.
 * 2. `start(surface)` — begin rendering to the given surface.
 * 3. `bindStream` / `unbindStream` — attach PTY output streams.
 * 4. `handleInput` — forward user input to a PTY.
 * 5. `resize` — notify the backend of dimension changes.
 * 6. `stop()` — release resources.
 *
 * Thread-safety: Adapters are assumed to be single-threaded and driven
 * exclusively by the renderer orchestration layer. Implementations must
 * not spawn their own event loops unless they are fully encapsulated.
 */
export interface RendererAdapter {
  /**
   * Unique, stable identifier for this backend (e.g. `"ghostty"`, `"rio"`).
   * Must not change after construction.
   */
  readonly id: string;

  /**
   * Semantic version string of the backend implementation.
   */
  readonly version: string;

  /**
   * Initialise the renderer with the given configuration.
   *
   * @param config - Rendering configuration.
   * @throws If initialisation fails (e.g. missing GPU driver).
   *         The adapter must transition to the `errored` state in that case.
   */
  init(config: RendererConfig): Promise<void>;

  /**
   * Begin rendering to the supplied surface.
   *
   * Must only be called after a successful `init()`.
   *
   * @param surface - Target render surface.
   * @throws If the surface cannot be acquired.
   */
  start(surface: RenderSurface): Promise<void>;

  /**
   * Stop rendering and release all resources.
   *
   * After `stop()` returns the adapter is in the `stopped` state and
   * must not emit further output.
   */
  stop(): Promise<void>;

  /**
   * Bind a PTY output stream so the renderer can display its content.
   *
   * The adapter begins consuming `stream` immediately. If a stream for the
   * same `ptyId` is already bound, the previous binding is replaced.
   *
   * @param ptyId  - Unique PTY identifier.
   * @param stream - Readable byte stream from the PTY.
   */
  bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void;

  /**
   * Unbind a previously bound PTY stream.
   *
   * If `ptyId` is not currently bound this is a no-op.
   *
   * @param ptyId - PTY identifier to unbind.
   */
  unbindStream(ptyId: string): void;

  /**
   * Forward user keyboard / mouse input to the specified PTY.
   *
   * @param ptyId - Target PTY.
   * @param data  - Raw input bytes.
   */
  handleInput(ptyId: string, data: Uint8Array): void;

  /**
   * Notify the backend that a terminal has been resized.
   *
   * @param ptyId - Target PTY.
   * @param cols  - New column count.
   * @param rows  - New row count.
   */
  resize(ptyId: string, cols: number, rows: number): void;

  /**
   * Query the capabilities of this renderer backend.
   *
   * Must return in < 50 ms (p95). If the adapter has not yet been
   * initialised, return static / default capabilities.
   */
  queryCapabilities(): RendererCapabilities;

  /**
   * Return the current lifecycle state of the adapter.
   */
  getState(): RendererState;

  /**
   * Register a handler that is called when the renderer crashes
   * unexpectedly while in the `running` state.
   *
   * @param handler - Callback receiving the crash error.
   */
  onCrash(handler: (error: Error) => void): void;
}
