// T003 - Lane lifecycle commands + T004 - Event publishing to local bus
// T006-T010 - Worktree provisioning plus delegated cleanup and orphan reconciliation
// T011-T015 - Par task binding, termination, execution, stale detection, lifecycle events

import type { LocalBus } from "../protocol/bus.js";
import { type PtyManager, cleanupLane } from "./cleanup.js";
import { type LaneBusEventTopic, publishLaneEvent, publishReconciliationEvent } from "./events.js";
import { generateLaneId, resetLaneIdCounter } from "./ids.js";
import { type FullReconciliationResult, reconcileLaneOrphans } from "./reconciliation.js";
import { LaneNotFoundError, type LaneRecord, LaneRegistry } from "./registry.js";
import { attachAgent, detachAgent, shareLane } from "./sharing.js";
import { type LaneState, recordTransition, transition, withLaneLock } from "./state_machine.js";
import { provisionWorktree } from "./worktree.js";

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Not implemented: ${operation} (placeholder for future WP)`);
    this.name = "NotImplementedError";
  }
}

/** Reset counter for testing. */
export function _resetIdCounter(): void {
  resetLaneIdCounter();
}

// ── Lane Manager ─────────────────────────────────────────────────────────────

export interface LaneManagerOptions {
  bus?: LocalBus | null;
  capacityLimit?: number;
  ptyManager?: PtyManager | null;
  ptyTerminationTimeoutMs?: number;
}

export class LaneManager {
  private readonly registry: LaneRegistry;
  private readonly bus: LocalBus | null;
  private readonly ptyManager: PtyManager | null;
  private readonly ptyTerminationTimeoutMs: number;

  constructor(options: LaneManagerOptions = {}) {
    this.registry = new LaneRegistry(options.capacityLimit ?? 50);
    this.bus = options.bus ?? null;
    this.ptyManager = options.ptyManager ?? null;
    this.ptyTerminationTimeoutMs = options.ptyTerminationTimeoutMs ?? 5000;
  }

  /** Expose registry for testing / sharing module integration. */
  getRegistry(): LaneRegistry {
    return this.registry;
  }

  // ── T003: create ─────────────────────────────────────────────────────────

  async create(workspaceId: string, baseBranch: string): Promise<LaneRecord> {
    const laneId = generateLaneId();

    return withLaneLock(laneId, async () => {
      const now = new Date().toISOString();
      const record: LaneRecord = {
        laneId,
        workspaceId,
        state: "new",
        worktreePath: null,
        parTaskPid: null,
        attachedAgents: [],
        baseBranch,
        createdAt: now,
        updatedAt: now,
      };

      this.registry.register(record);

      // Transition new -> provisioning
      const fromState: LaneState = "new";
      const toState = transition(fromState, "create", laneId);
      recordTransition(laneId, fromState, "create", toState);
      this.registry.update(laneId, { state: toState });

      await this.emitEvent("lane.created", laneId, workspaceId, fromState, toState);

      const updated = this.registry.get(laneId);
      return updated!;
    });
  }

  // ── T006+T010: provision worktree for a lane in provisioning state ──────

  async provision(laneId: string, workspaceRepoPath: string): Promise<LaneRecord> {
    return withLaneLock(laneId, async () => {
      const lane = this.registry.get(laneId);
      if (!lane) {
        throw new LaneNotFoundError(laneId);
      }
      if (lane.state !== "provisioning") {
        throw new Error(`Cannot provision lane in state ${lane.state}`);
      }

      try {
        const result = await provisionWorktree({
          workspaceRepoPath,
          laneId,
          baseBranch: lane.baseBranch,
        });

        // Transition provisioning -> ready
        const fromState = lane.state;
        const toState = transition(fromState, "provision_complete", laneId);
        recordTransition(laneId, fromState, "provision_complete", toState);
        this.registry.update(laneId, {
          state: toState,
          worktreePath: result.worktreePath,
        });

        await this.emitEvent(
          "lane.worktree.provisioned",
          laneId,
          lane.workspaceId,
          fromState,
          toState
        );
        await this.emitEvent("lane.state.changed", laneId, lane.workspaceId, fromState, toState);
        return this.registry.get(laneId)!;
      } catch (err) {
        // T010: Partial provisioning failure - clean up and close lane
        const fromState = lane.state;
        const toState = transition(fromState, "provision_failed", laneId);
        recordTransition(laneId, fromState, "provision_failed", toState);
        this.registry.update(laneId, { state: toState });

        await this.emitEvent("lane.provision_failed", laneId, lane.workspaceId, fromState, toState);

        throw err;
      }
    });
  }

  // ── T003: list ───────────────────────────────────────────────────────────

  list(workspaceId?: string): LaneRecord[] {
    if (workspaceId !== undefined) {
      return this.registry.getByWorkspace(workspaceId);
    }
    return this.registry.list();
  }

  // ── T003: attach ─────────────────────────────────────────────────────────

  async attach(laneId: string, agentId: string): Promise<void> {
    await attachAgent(this.registry, laneId, agentId);
  }

  // ── T003: detach ─────────────────────────────────────────────────────────

  async detach(laneId: string, agentId: string): Promise<void> {
    const result = await detachAgent(this.registry, laneId, agentId);
    if (result.transitioned && result.fromState !== undefined && result.toState !== undefined) {
      const lane = this.registry.get(laneId);
      await this.emitEvent(
        "lane.state.changed",
        laneId,
        lane?.workspaceId ?? "",
        result.fromState,
        result.toState
      );
    }
  }

  // ── T005: share ──────────────────────────────────────────────────────────

  async share(laneId: string): Promise<void> {
    const result = await shareLane(this.registry, laneId);
    if (result.fromState !== result.toState) {
      const lane = this.registry.get(laneId);
      await this.emitEvent(
        "lane.shared",
        laneId,
        lane?.workspaceId ?? "",
        result.fromState,
        result.toState
      );
    }
  }

  // ── T003: cleanup ────────────────────────────────────────────────────────

  async cleanup(laneId: string, force = false): Promise<void> {
    await withLaneLock(laneId, async () => {
      await cleanupLane({
        emitEvent: this.emitEvent.bind(this),
        force,
        laneId,
        ptyManager: this.ptyManager,
        ptyTerminationTimeoutMs: this.ptyTerminationTimeoutMs,
        registry: this.registry,
      });
    });
  }

  // ── T016: Full orphaned lane reconciliation on startup ─────────────────

  async reconcileOrphans(
    workspaceRepoPath: string,
    options?: { timeoutMs?: number }
  ): Promise<FullReconciliationResult> {
    return await reconcileLaneOrphans({
      emitReconciliationEvent: this.emitReconciliationEvent.bind(this),
      ptyManager: this.ptyManager,
      registry: this.registry,
      timeoutMs: options?.timeoutMs ?? 30_000,
      workspaceRepoPath,
    });
  }

  private async emitReconciliationEvent(result: FullReconciliationResult): Promise<void> {
    if (!this.bus) {
      return;
    }
    await publishReconciliationEvent(this.bus, result);
  }

  // ── T004: Event Publishing ───────────────────────────────────────────────

  private async emitEvent(
    topic: LaneBusEventTopic,
    laneId: string,
    workspaceId: string,
    fromState: LaneState,
    toState: LaneState
  ): Promise<void> {
    if (!this.bus) {
      return;
    }
    await publishLaneEvent(this.bus, topic, laneId, workspaceId, fromState, toState);
  }
}

// Re-export public types
export { LaneRegistry, type LaneRecord, LaneNotFoundError } from "./registry.js";
export type { LaneState, LaneEvent } from "./state_machine.js";
export {
  InvalidLaneTransitionError,
  transition,
  withLaneLock,
  getTransitionHistory,
} from "./state_machine.js";
export { LaneClosedError, SharedLaneCleanupError } from "./sharing.js";
export type { PtyHandle, PtyManager } from "./cleanup.js";
export type { FullReconciliationResult } from "./reconciliation.js";
export type { LaneBusEventTopic } from "./events.js";
export {
  provisionWorktree,
  removeWorktree,
  reconcileOrphanedWorktrees,
  WorktreeProvisionError,
  WorktreeCleanupError,
  computeWorktreePath,
  computeBranchName,
  type WorktreeOptions,
  type WorktreeResult,
  type ReconciliationResult,
} from "./worktree.js";
export {
  ParManager,
  ParNotFoundError,
  ParSpawnError,
  LaneNotReadyError,
  ExecTimeoutError,
  _resetParIdCounter,
  type ParBinding,
  type ExecResult,
  type ParManagerOptions,
  type SpawnFn,
  type SpawnResult,
} from "./par.js";
