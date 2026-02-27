/**
 * PTY Lifecycle Manager — public API surface.
 *
 * Re-exports types and provides the {@link PtyManager} facade
 * for all PTY operations.
 *
 * @module
 */

export {
  type PtyState,
  type PtyEvent,
  type TransitionRecord,
  PtyLifecycle,
  InvalidTransitionError,
  transition,
} from "./state_machine.js";

export {
  type PtyRecord,
  type PtyDimensions,
  type ReconciliationSummary,
  PtyRegistry,
  DuplicatePtyError,
  RegistryCapacityError,
} from "./registry.js";

export { type SpawnOptions, type SpawnResult, spawnPty } from "./spawn.js";

// Local imports for use in PtyManager class body.
import { PtyRegistry as _PtyRegistry } from "./registry.js";
import { spawnPty as _spawnPty } from "./spawn.js";
import type { SpawnOptions as _SpawnOptions } from "./spawn.js";
import type { PtyRecord as _PtyRecord } from "./registry.js";
import type { ReconciliationSummary as _ReconciliationSummary } from "./registry.js";

/**
 * Error thrown by placeholder methods that are not yet implemented.
 */
export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not yet implemented (planned for WP02)`);
    this.name = "NotImplementedError";
  }
}

/**
 * High-level facade for PTY operations.
 *
 * Wraps the state machine, registry, and spawn logic into a single
 * entry point consumed by upstream specs (008, 009).
 */
export class PtyManager {
  /** The underlying process registry. */
  public readonly registry: _PtyRegistry;

  /**
   * @param maxCapacity - Maximum number of concurrent PTYs (default 300).
   */
  constructor(maxCapacity = 300) {
    this.registry = new _PtyRegistry(maxCapacity);
  }

  /**
   * Spawn a new PTY process and register it.
   *
   * @param options - Spawn configuration.
   * @returns The newly created {@link PtyRecord}.
   */
  async spawn(options: _SpawnOptions): Promise<_PtyRecord> {
    const result = await _spawnPty(options, this.registry);
    return result.record;
  }

  /**
   * Look up a PTY record by ID.
   *
   * @param ptyId - The PTY ID.
   * @returns The record, or `undefined` if not found.
   */
  get(ptyId: string): _PtyRecord | undefined {
    return this.registry.get(ptyId);
  }

  /**
   * Get all PTY records for a given lane.
   *
   * @param laneId - The lane ID.
   * @returns An array of matching records.
   */
  getByLane(laneId: string): _PtyRecord[] {
    return this.registry.getByLane(laneId);
  }

  /**
   * Terminate a PTY process gracefully.
   *
   * @param _ptyId - The PTY ID.
   * @throws {@link NotImplementedError} — placeholder for WP02.
   */
  async terminate(_ptyId: string): Promise<void> {
    throw new NotImplementedError("PtyManager.terminate");
  }

  /**
   * Resize a PTY viewport.
   *
   * @param _ptyId - The PTY ID.
   * @param _cols - New column count.
   * @param _rows - New row count.
   * @throws {@link NotImplementedError} — placeholder for WP02.
   */
  resize(_ptyId: string, _cols: number, _rows: number): void {
    throw new NotImplementedError("PtyManager.resize");
  }

  /**
   * Write input data to a PTY.
   *
   * @param _ptyId - The PTY ID.
   * @param _data - The data to write.
   * @throws {@link NotImplementedError} — placeholder for WP02.
   */
  writeInput(_ptyId: string, _data: Uint8Array): void {
    throw new NotImplementedError("PtyManager.writeInput");
  }

  /**
   * Reconcile orphaned PTY processes on startup.
   *
   * @returns A reconciliation summary.
   */
  async reconcileOrphans(): Promise<_ReconciliationSummary> {
    return this.registry.reconcileOrphans();
  }
}
