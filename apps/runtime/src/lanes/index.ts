// T003 - Lane lifecycle commands + T004 - Event publishing to local bus
// T006-T010 - Worktree provisioning, cleanup, PTY termination, orphan reconciliation

import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProtocolBus as LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import { LaneNotFoundError, type LaneRecord, LaneRegistry } from "./registry.js";
import { SharedLaneCleanupError, attachAgent, detachAgent, shareLane } from "./sharing.js";
import { type LaneState, recordTransition, transition, withLaneLock } from "./state_machine.js";
import { provisionWorktree, reconcileOrphanedWorktrees, removeWorktree } from "./worktree.js";

// ── T016: Full Reconciliation Result ─────────────────────────────────────────

export interface FullReconciliationResult {
  orphanedWorktrees: number;
  orphanedRecords: number;
  orphanedParTasks: number;
  orphanedPtys: number;
  totalCleaned: number;
  cleaned: number;
  timedOut: boolean;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Not implemented: ${operation} (placeholder for future WP)`);
    this.name = "NotImplementedError";
  }
}

// ── PTY Manager Interface (T008) ────────────────────────────────────────────

export interface PtyHandle {
  ptyId: string;
  laneId: string;
}

export interface PtyManager {
  getByLane(laneId: string): PtyHandle[];
  terminate(ptyId: string): Promise<void>;
}

// ── Event Types ──────────────────────────────────────────────────────────────

export type LaneBusEventTopic =
  | "lane.created"
  | "lane.state.changed"
  | "lane.shared"
  | "lane.cleaning"
  | "lane.closed"
  | "lane.ptys_terminated"
  | "lane.provision_failed"
  | "reconciliation.completed";

// ── ID Generation ────────────────────────────────────────────────────────────

let laneIdCounter = 0;

function generateLaneId(): string {
  laneIdCounter += 1;
  return `lane_${Date.now()}_${laneIdCounter.toString(36)}`;
}

/** Reset counter for testing. */
export function _resetIdCounter(): void {
  laneIdCounter = 0;
}

// ── Lane Manager ─────────────────────────────────────────────────────────────

export interface LaneManagerOptions {
  bus?: LocalBus | null;
  capacityLimit?: number;
  ptyManager?: PtyManager | null;
  ptyTerminationTimeoutMs?: number;
}

type LaneEventBus = LocalBus & {
  pushEvent?: (event: LocalBusEnvelope) => void;
};

export class LaneManager {
  private readonly registry: LaneRegistry;
  private readonly bus: LaneEventBus | null;
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

  create(workspaceId: string, baseBranch: string): Promise<LaneRecord> {
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
      if (updated === undefined) {
        throw new Error(`Lane ${laneId} creation failed`);
      }

      return updated;
    });
  }

  // ── T006+T010: provision worktree for a lane in provisioning state ──────

  provision(laneId: string, workspaceRepoPath: string): Promise<LaneRecord> {
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

        await this.emitEvent("lane.state.changed", laneId, lane.workspaceId, fromState, toState);
        const updated = this.registry.get(laneId);
        if (updated === undefined) {
          throw new LaneNotFoundError(laneId);
        }
        return updated;
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
      const lane = this.registry.get(laneId);
      if (lane === undefined || lane.state === "closed") {
        return;
      }

      await this.prepareLaneForCleanup(laneId, lane, force);
      await this.terminateLanePtys(laneId, lane.workspaceId);

      const updatedLane = this.registry.get(laneId);
      if (updatedLane?.worktreePath) {
        await this.removeLaneWorktree(laneId, updatedLane.worktreePath);
        this.registry.update(laneId, { worktreePath: null });
      }

      await this.finalizeLaneCleanup(laneId, lane.workspaceId);
    });
  }

  private async prepareLaneForCleanup(
    laneId: string,
    lane: LaneRecord,
    force: boolean
  ): Promise<void> {
    if (lane.state === "cleaning") {
      const closedState = transition("cleaning", "cleanup_complete", laneId);
      recordTransition(laneId, "cleaning", "cleanup_complete", closedState);
      this.registry.update(laneId, { state: closedState });
      await this.emitEvent("lane.closed", laneId, lane.workspaceId, "cleaning", closedState);
      return;
    }

    if (lane.state === "shared" && lane.attachedAgents.length > 0) {
      if (!force) {
        throw new SharedLaneCleanupError(laneId, lane.attachedAgents.length);
      }
      this.registry.update(laneId, { attachedAgents: [] });
      const midState = transition(lane.state, "unshare", laneId);
      recordTransition(laneId, lane.state, "unshare", midState);
      this.registry.update(laneId, { state: midState });
      const cleaningState = transition(midState, "request_cleanup", laneId);
      recordTransition(laneId, midState, "request_cleanup", cleaningState);
      this.registry.update(laneId, { state: cleaningState });
      await this.emitEvent("lane.cleaning", laneId, lane.workspaceId, lane.state, cleaningState);
      return;
    }

    const fromState = lane.state;
    const toState = transition(fromState, "request_cleanup", laneId);
    recordTransition(laneId, fromState, "request_cleanup", toState);
    this.registry.update(laneId, { state: toState });
    await this.emitEvent("lane.cleaning", laneId, lane.workspaceId, fromState, toState);
  }

  private async removeLaneWorktree(_laneId: string, worktreePath: string): Promise<void> {
    // Infer workspaceRepoPath from worktreePath:
    // <workspaceRepoPath>/.helios-worktrees/<laneId>
    const worktreeParent = dirname(worktreePath);
    const workspaceRepoPath = dirname(worktreeParent);
    try {
      await removeWorktree(worktreePath, workspaceRepoPath);
    } catch {
      // Best-effort: worktree may already be removed
    }
  }

  private async finalizeLaneCleanup(laneId: string, workspaceId: string): Promise<void> {
    const updatedLane = this.registry.get(laneId);
    if (updatedLane === undefined) {
      return;
    }
    const closedState = transition(updatedLane.state, "cleanup_complete", laneId);
    recordTransition(laneId, updatedLane.state, "cleanup_complete", closedState);
    this.registry.update(laneId, { state: closedState });
    await this.emitEvent("lane.closed", laneId, workspaceId, updatedLane.state, closedState);
  }

  // ── T008: Graceful PTY termination before worktree removal ───────────────

  private async terminateLanePtys(laneId: string, workspaceId: string): Promise<void> {
    if (!this.ptyManager) {
      return;
    }

    let ptys: PtyHandle[];
    try {
      ptys = this.ptyManager.getByLane(laneId);
    } catch {
      // PTY manager unavailable - proceed with best effort
      return;
    }

    if (ptys.length === 0) {
      return;
    }

    let _forceKilled = 0;
    const terminationPromises = ptys.map(async pty => {
      try {
        const timeout = new Promise<"timeout">(resolve =>
          setTimeout(() => resolve("timeout"), this.ptyTerminationTimeoutMs)
        );
        const termination = this.ptyManager?.terminate(pty.ptyId).then(() => "done" as const);
        const result = await Promise.race([termination, timeout]);
        if (result === "timeout") {
          _forceKilled++;
        }
      } catch {
        _forceKilled++;
      }
    });

    await Promise.all(terminationPromises);

    await this.emitEvent("lane.ptys_terminated", laneId, workspaceId, "cleaning", "cleaning");
  }

  // ── T016: Full orphaned lane reconciliation on startup ─────────────────

  async reconcileOrphans(
    workspaceRepoPath: string,
    options?: { timeoutMs?: number }
  ): Promise<FullReconciliationResult> {
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const startTime = Date.now();

    const result: FullReconciliationResult = {
      orphanedWorktrees: 0,
      orphanedRecords: 0,
      orphanedParTasks: 0,
      orphanedPtys: 0,
      totalCleaned: 0,
      cleaned: 0,
      timedOut: false,
    };

    const isTimedOut = (): boolean => Date.now() - startTime >= timeoutMs;
    const activeLanes = this.registry.getActive();
    const knownLaneIds = this.buildLaneIdSet(activeLanes);

    try {
      await this.reconcileOrphanedWorktreeDirectories(
        workspaceRepoPath,
        knownLaneIds,
        isTimedOut,
        result
      );
      await this.reconcileOrphanedRegistryWorktrees(activeLanes, isTimedOut, result);
      this.reconcileOrphanedParTasks(isTimedOut, result);
      await this.reconcileOrphanedPtys(isTimedOut, result);
    } catch {
      // Partial reconciliation - log and continue
    }

    if (isTimedOut()) {
      result.timedOut = true;
    }

    // Publish reconciliation.completed event
    await this.emitReconciliationEvent(result);

    return result;
  }

  private buildLaneIdSet(lanes: LaneRecord[]): Set<string> {
    const knownLaneIds = new Set<string>();
    for (const lane of lanes) {
      knownLaneIds.add(lane.laneId);
    }
    return knownLaneIds;
  }

  private async reconcileOrphanedWorktreeDirectories(
    workspaceRepoPath: string,
    knownLaneIds: Set<string>,
    isTimedOut: () => boolean,
    result: FullReconciliationResult
  ): Promise<void> {
    if (isTimedOut()) {
      return;
    }

    try {
      const worktreeResult = await reconcileOrphanedWorktrees(
        workspaceRepoPath,
        knownLaneIds,
        laneId => {
          try {
            this.registry.update(laneId, { state: "closed" });
          } catch {
            // Lane may have been removed between enumeration and cleanup
          }
        }
      );

      result.orphanedWorktrees += worktreeResult.orphanedWorktrees;
      result.cleaned += worktreeResult.cleaned;
      result.totalCleaned += worktreeResult.cleaned;
    } catch {
      // Best effort; continue other phases
    }
  }

  private reconcileOrphanedRegistryWorktrees(
    activeLanes: LaneRecord[],
    isTimedOut: () => boolean,
    result: FullReconciliationResult
  ): void {
    for (const lane of activeLanes) {
      if (isTimedOut()) {
        break;
      }
      if (lane.worktreePath !== null && !existsSync(lane.worktreePath)) {
        result.orphanedRecords++;
        result.totalCleaned++;
        this.registry.update(lane.laneId, { state: "closed", worktreePath: null });
      }
    }
  }

  private reconcileOrphanedParTasks(
    isTimedOut: () => boolean,
    result: FullReconciliationResult
  ): void {
    if (isTimedOut()) {
      return;
    }

    const allLanes = this.registry.list();
    for (const lane of allLanes) {
      if (isTimedOut()) {
        return;
      }
      if (lane.parTaskPid === null || lane.state === "closed") {
        continue;
      }
      try {
        process.kill(lane.parTaskPid, 0);
      } catch {
        result.orphanedParTasks++;
        result.totalCleaned++;
        this.registry.update(lane.laneId, { parTaskPid: null });
      }
    }
  }

  private async reconcileOrphanedPtys(
    isTimedOut: () => boolean,
    result: FullReconciliationResult
  ): Promise<void> {
    if (this.ptyManager === null || isTimedOut()) {
      return;
    }

    const closedLanes = this.registry.list().filter(lane => lane.state === "closed");
    const terminateOperations = closedLanes.map(async lane => {
      if (isTimedOut()) {
        return;
      }
      await this.terminateLanePtysForLane(lane.laneId, result);
    });

    await Promise.all(terminateOperations);
  }

  private async terminateLanePtysForLane(
    laneId: string,
    result: FullReconciliationResult
  ): Promise<void> {
    if (this.ptyManager === null) {
      return;
    }

    try {
      const ptys = this.ptyManager.getByLane(laneId);
      for (const pty of ptys) {
        result.orphanedPtys++;
        result.totalCleaned++;
        try {
          await this.ptyManager.terminate(pty.ptyId);
        } catch {
          // Best-effort: leave cleanup incomplete for this PTY
        }
      }
    } catch {
      // PTY manager unavailable for this lane
    }
  }

  private async emitReconciliationEvent(result: FullReconciliationResult): Promise<void> {
    if (!this.bus) {
      return;
    }

    const envelope: LocalBusEnvelope = {
      id: `reconciliation:${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "reconciliation.completed",
      payload: {
        orphanedWorktrees: result.orphanedWorktrees,
        orphanedRecords: result.orphanedRecords,
        orphanedParTasks: result.orphanedParTasks,
        orphanedPtys: result.orphanedPtys,
        totalCleaned: result.totalCleaned,
        timedOut: result.timedOut,
      },
    };
    await this.emitBusEvent(envelope);
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

    const envelope: LocalBusEnvelope = {
      id: `${laneId}:${topic}:${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload: {
        laneId,
        workspaceId,
        fromState,
        toState,
        correlationId: laneId,
      },
    };
    envelope.workspace_id = workspaceId;
    envelope.lane_id = laneId;
    await this.emitBusEvent(envelope);
  }

  private async emitBusEvent(envelope: LocalBusEnvelope): Promise<void> {
    if (!this.bus) {
      return;
    }

    try {
      if (typeof this.bus.pushEvent === "function") {
        this.bus.pushEvent(envelope);
      } else {
        await this.bus.publish(envelope);
      }
    } catch {
      // T004: Bus failures do not block lane operations (fire-and-forget)
    }
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
