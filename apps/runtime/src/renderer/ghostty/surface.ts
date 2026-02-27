/**
 * Ghostty surface binding (T003).
 *
 * Connects ghostty rendering output to the ElectroBun window surface
 * and handles resize / unbind lifecycle.
 */

import type { RenderSurface } from "../adapter.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SurfaceBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurfaceBindingError";
  }
}

// ---------------------------------------------------------------------------
// Surface manager
// ---------------------------------------------------------------------------

export class GhosttySurface {
  private _bound = false;
  private _surface: RenderSurface | undefined;
  private _processPid: number | undefined;

  /** Whether a surface is currently bound. */
  isBound(): boolean {
    return this._bound;
  }

  /** The currently bound surface, or undefined. */
  getSurface(): RenderSurface | undefined {
    return this._surface;
  }

  /**
   * Bind ghostty to the given render surface.
   *
   * @param surface - The window region to render into.
   * @param processPid - PID of the ghostty process.
   * @throws {SurfaceBindingError} if binding fails.
   */
  bind(surface: RenderSurface, processPid: number): void {
    if (this._bound) {
      this.unbind();
    }

    // Validate surface has non-zero dimensions
    if (surface.bounds.width <= 0 || surface.bounds.height <= 0) {
      // Zero-size surface (e.g., minimized window) -- bind but skip rendering
      this._surface = surface;
      this._processPid = processPid;
      this._bound = true;
      return;
    }

    // Platform-specific binding logic
    // On macOS: configure ghostty to render into the native view
    // On Linux: configure X11/Wayland surface sharing
    // For now, store the binding metadata; actual IPC channel setup
    // depends on the ghostty integration method (offscreen buffer, etc.)
    this._surface = surface;
    this._processPid = processPid;
    this._bound = true;
  }

  /**
   * Unbind ghostty from the current surface and release resources.
   */
  unbind(): void {
    if (!this._bound) {
      return;
    }
    this._surface = undefined;
    this._processPid = undefined;
    this._bound = false;
  }

  /**
   * Update the render region bounds (e.g., on window resize).
   *
   * @param bounds - New pixel-space bounding box.
   */
  resize(bounds: { x: number; y: number; width: number; height: number }): void {
    if (!this._bound || this._surface === undefined) {
      return;
    }
    this._surface = {
      ...this._surface,
      bounds,
    };
    // Notify ghostty of the dimension change.
    // In a real integration this would send a resize message via IPC.
  }
}
