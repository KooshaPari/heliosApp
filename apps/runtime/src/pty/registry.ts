import type { PtyState } from "./state_machine.js";
import {
  reconcileRegistryOrphans,
} from "./registry_reconciliation.js";

/** Dimensions of a PTY viewport. */
export interface PtyDimensions {
  readonly cols: number;
  readonly rows: number;
}

/** A single PTY record in the registry. */
export interface PtyRecord {
  readonly ptyId: string;
  readonly laneId: string;
  readonly sessionId: string;
  readonly terminalId: string;
  readonly pid: number;
  state: PtyState;
  dimensions: PtyDimensions;
  readonly createdAt: number;
  updatedAt: number;
  readonly env: Readonly<Record<string, string>>;
}

/** Error thrown when a duplicate PTY ID is registered. */
export class DuplicatePtyError extends Error {
  constructor(ptyId: string) {
    super(`PTY '${ptyId}' is already registered`);
    this.name = "DuplicatePtyError";
  }
}

/** Error thrown when the registry capacity is exceeded. */
export class RegistryCapacityError extends Error {
  constructor(capacity: number) {
    super(`PTY registry capacity exceeded (max ${capacity})`);
    this.name = "RegistryCapacityError";
  }
}

/** Summary of an orphan reconciliation run. */
export interface ReconciliationSummary {
  readonly found: number;
  readonly reattached: number;
  readonly terminated: number;
  readonly errors: number;
  readonly durationMs: number;
}

/**
 * In-memory registry of PTY records with O(1) lookups by PTY ID
 * and secondary indexes for lane and session.
 */
export class PtyRegistry {
  private readonly primary = new Map<string, PtyRecord>();
  private readonly byLane = new Map<string, Set<string>>();
  private readonly bySession = new Map<string, Set<string>>();
  private readonly maxCapacity: number;

  /**
   * @param maxCapacity - Maximum number of PTY records (default 300 per NFR-007-003).
   */
  constructor(maxCapacity = 300) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Register a new PTY record.
   *
   * @param record - The PTY record to register.
   * @throws {@link DuplicatePtyError} if the ptyId is already registered.
   * @throws {@link RegistryCapacityError} if the registry is full.
   */
  register(record: PtyRecord): void {
    if (this.primary.has(record.ptyId)) {
      throw new DuplicatePtyError(record.ptyId);
    }
    if (this.primary.size >= this.maxCapacity) {
      throw new RegistryCapacityError(this.maxCapacity);
    }

    this.primary.set(record.ptyId, record);
    this.addToIndex(this.byLane, record.laneId, record.ptyId);
    this.addToIndex(this.bySession, record.sessionId, record.ptyId);
  }

  /**
   * Look up a PTY record by ID.
   *
   * @param ptyId - The PTY ID.
   * @returns The record, or `undefined` if not found.
   */
  get(ptyId: string): PtyRecord | undefined {
    return this.primary.get(ptyId);
  }

  /**
   * Get all PTY records for a given lane.
   *
   * @param laneId - The lane ID.
   * @returns An array of matching records.
   */
  getByLane(laneId: string): PtyRecord[] {
    return this.resolveIndex(this.byLane, laneId);
  }

  /**
   * Get all PTY records for a given session.
   *
   * @param sessionId - The session ID.
   * @returns An array of matching records.
   */
  getBySession(sessionId: string): PtyRecord[] {
    return this.resolveIndex(this.bySession, sessionId);
  }

  /**
   * Partially update a PTY record. Automatically bumps `updatedAt`.
   *
   * @param ptyId - The PTY ID.
   * @param patch - Fields to update.
   */
  update(ptyId: string, patch: Partial<PtyRecord>): void {
    const existing = this.primary.get(ptyId);
    if (!existing) {
      return;
    }

    // If laneId or sessionId changed, update secondary indexes.
    if (patch.laneId !== undefined && patch.laneId !== existing.laneId) {
      this.removeFromIndex(this.byLane, existing.laneId, ptyId);
      this.addToIndex(this.byLane, patch.laneId, ptyId);
    }
    if (
      patch.sessionId !== undefined &&
      patch.sessionId !== existing.sessionId
    ) {
      this.removeFromIndex(this.bySession, existing.sessionId, ptyId);
      this.addToIndex(this.bySession, patch.sessionId, ptyId);
    }

    Object.assign(existing, patch, { updatedAt: Date.now() });
  }

  /**
   * Remove a PTY record from the registry and all indexes.
   *
   * @param ptyId - The PTY ID.
   */
  remove(ptyId: string): void {
    const record = this.primary.get(ptyId);
    if (!record) {
      return;
    }

    this.removeFromIndex(this.byLane, record.laneId, ptyId);
    this.removeFromIndex(this.bySession, record.sessionId, ptyId);
    this.primary.delete(ptyId);
  }

  /**
   * List all PTY records.
   *
   * @returns A snapshot array of all records.
   */
  list(): PtyRecord[] {
    return Array.from(this.primary.values());
  }

  /**
   * Total count of registered PTYs.
   */
  count(): number {
    return this.primary.size;
  }

  async reconcileOrphans(
    shellPatterns: string[] = ["bash", "zsh", "sh", "fish"],
    gracePeriodMs = 5000,
  ): Promise<ReconciliationSummary> {
    return reconcileRegistryOrphans(this, shellPatterns, gracePeriodMs);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    ptyId: string,
  ): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(ptyId);
  }

  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    ptyId: string,
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(ptyId);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  private resolveIndex(
    index: Map<string, Set<string>>,
    key: string,
  ): PtyRecord[] {
    const ids = index.get(key);
    if (!ids) return [];
    const records: PtyRecord[] = [];
    for (const id of ids) {
      const rec = this.primary.get(id);
      if (rec) records.push(rec);
    }
    return records;
  }

}
