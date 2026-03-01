/**
 * Renderer registry.
 *
 * Manages registered renderer backends and enforces the single-active
 * constraint (FR-010-008): exactly one renderer may be active at a time.
 */

import type { RendererAdapter } from "./adapter.js";
import type { RendererCapabilities } from "./capabilities.js";

// ---------------------------------------------------------------------------
// Registration metadata
// ---------------------------------------------------------------------------

/** Metadata stored alongside a registered adapter. */
export interface RegistrationMeta {
  id: string;
  version: string;
  registeredAt: number;
  capabilities: RendererCapabilities;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DuplicateRendererError extends Error {
  constructor(id: string) {
    super(`Renderer "${id}" is already registered`);
    this.name = "DuplicateRendererError";
  }
}

export class RendererNotFoundError extends Error {
  constructor(id: string) {
    super(`Renderer "${id}" is not registered`);
    this.name = "RendererNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of renderer backends.
 *
 * Provides CRUD operations for adapter registration, lookup, and
 * single-active management.
 */
export class RendererRegistry {
  private readonly _adapters = new Map<string, RendererAdapter>();
  private readonly _meta = new Map<string, RegistrationMeta>();
  private _activeId: string | undefined;

  /**
   * Register a renderer backend.
   *
   * @param adapter - The adapter to register.
   * @throws {DuplicateRendererError} if an adapter with the same `id` is
   *         already registered.
   */
  register(adapter: RendererAdapter): void {
    if (this._adapters.has(adapter.id)) {
      throw new DuplicateRendererError(adapter.id);
    }
    this._adapters.set(adapter.id, adapter);
    this._meta.set(adapter.id, {
      id: adapter.id,
      version: adapter.version,
      registeredAt: Date.now(),
      capabilities: adapter.queryCapabilities(),
    });
  }

  /**
   * Unregister a renderer backend.
   *
   * If the adapter is currently active it is deactivated first.
   *
   * @param id - Adapter ID.
   * @throws {RendererNotFoundError} if the ID is not registered.
   */
  unregister(id: string): void {
    if (!this._adapters.has(id)) {
      throw new RendererNotFoundError(id);
    }
    if (this._activeId === id) {
      this._activeId = undefined;
    }
    this._adapters.delete(id);
    this._meta.delete(id);
  }

  /**
   * Look up a registered adapter by ID.
   *
   * @returns The adapter, or `undefined` if not registered.
   */
  get(id: string): RendererAdapter | undefined {
    return this._adapters.get(id);
  }

  /** Return all registered adapters. */
  list(): RendererAdapter[] {
    return [...this._adapters.values()];
  }

  /** Return the currently active renderer, if any. */
  getActive(): RendererAdapter | undefined {
    return this._activeId !== undefined
      ? this._adapters.get(this._activeId)
      : undefined;
  }

  /**
   * Mark a renderer as the active one.
   *
   * @param id - Adapter ID to activate.
   * @throws {RendererNotFoundError} if the ID is not registered.
   */
  setActive(id: string): void {
    if (!this._adapters.has(id)) {
      throw new RendererNotFoundError(id);
    }
    this._activeId = id;
  }

  /**
   * Clear the active renderer selection.
   *
   * No-op if no renderer is currently active.
   */
  clearActive(): void {
    this._activeId = undefined;
  }

  /**
   * Shortcut to query capabilities for a specific backend.
   *
   * @param id - Adapter ID.
   * @throws {RendererNotFoundError} if the ID is not registered.
   */
  getCapabilities(id: string): RendererCapabilities {
    const meta = this._meta.get(id);
    if (meta === undefined) {
      throw new RendererNotFoundError(id);
    }
    return meta.capabilities;
  }

  /**
   * Refresh cached capabilities for an adapter (e.g. after init).
   *
   * @param id - Adapter ID.
   * @throws {RendererNotFoundError} if the ID is not registered.
   */
  refreshCapabilities(id: string): void {
    const adapter = this._adapters.get(id);
    const meta = this._meta.get(id);
    if (adapter === undefined || meta === undefined) {
      throw new RendererNotFoundError(id);
    }
    meta.capabilities = adapter.queryCapabilities();
  }
}
