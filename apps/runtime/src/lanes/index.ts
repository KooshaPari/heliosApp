// T003 - Lane lifecycle commands + T004 - Event publishing to local bus

import type { LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import { LaneRegistry, type LaneRecord, LaneNotFoundError } from "./registry.js";
import {
  transition,
  withLaneLock,
  recordTransition,
  type LaneState,
  type LaneEvent,
} from "./state_machine.js";
import {
  shareLane,
  attachAgent,
  detachAgent,
  forceDetachAll,
  LaneClosedError,
  SharedLaneCleanupError,
} from "./sharing.js";

// ── Errors ───────────────────────────────────────────────────────────────────

export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Not implemented: ${operation} (placeholder for future WP)`);
    this.name = "NotImplementedError";
  }
}

// ── Event Types ──────────────────────────────────────────────────────────────

export type LaneBusEventTopic =
  | "lane.created"
  | "lane.state.changed"
  | "lane.shared"
  | "lane.cleaning"
  | "lane.closed";

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
}

export class LaneManager {
  private readonly registry: LaneRegistry;
  private readonly bus: LocalBus | null;

  constructor(options: LaneManagerOptions = {}) {
    this.registry = new LaneRegistry(options.capacityLimit ?? 50);
    this.bus = options.bus ?? null;
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
        result.toState,
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
        result.toState,
      );
    }
  }

  // ── T003: cleanup ────────────────────────────────────────────────────────

  async cleanup(laneId: string, force: boolean = false): Promise<void> {
    await withLaneLock(laneId, async () => {
      const lane = this.registry.get(laneId);
      if (!lane) {
        // Idempotent: already cleaned up / non-existent
        return;
      }

      // Already closed: idempotent
      if (lane.state === "closed") {
        return;
      }

      // Already cleaning: idempotent
      if (lane.state === "cleaning") {
        // Still complete the cleanup
        const closedState = transition("cleaning", "cleanup_complete", laneId);
        recordTransition(laneId, "cleaning", "cleanup_complete", closedState);
        this.registry.update(laneId, { state: closedState });
        await this.emitEvent("lane.closed", laneId, lane.workspaceId, "cleaning", closedState);
        return;
      }

      // Shared lane with active agents
      if (lane.state === "shared" && lane.attachedAgents.length > 0) {
        if (force) {
          // Force-detach all agents, transition shared -> ready -> cleaning -> closed
          this.registry.update(laneId, { attachedAgents: [] });
          const midState = transition(lane.state, "unshare", laneId);
          recordTransition(laneId, lane.state, "unshare", midState);
          this.registry.update(laneId, { state: midState });
          const cleaningState = transition(midState, "request_cleanup", laneId);
          recordTransition(laneId, midState, "request_cleanup", cleaningState);
          this.registry.update(laneId, { state: cleaningState });
          await this.emitEvent("lane.cleaning", laneId, lane.workspaceId, lane.state, cleaningState);
        } else {
          throw new SharedLaneCleanupError(laneId, lane.attachedAgents.length);
        }
      } else {
        // Normal cleanup transition
        const fromState = lane.state;
        const toState = transition(fromState, "request_cleanup", laneId);
        recordTransition(laneId, fromState, "request_cleanup", toState);
        this.registry.update(laneId, { state: toState });
        await this.emitEvent("lane.cleaning", laneId, lane.workspaceId, fromState, toState);
      }

      // Placeholder: WP02 worktree cleanup, WP03 par/PTY cleanup would go here
      // For now, immediately transition to closed

      const currentLane = this.registry.get(laneId)!;
      const cleaningFrom = currentLane.state;
      const closedState = transition(cleaningFrom, "cleanup_complete", laneId);
      recordTransition(laneId, cleaningFrom, "cleanup_complete", closedState);
      this.registry.update(laneId, { state: closedState });
      await this.emitEvent("lane.closed", laneId, lane.workspaceId, cleaningFrom, closedState);
    });
  }

  // ── T004: Event Publishing ───────────────────────────────────────────────

  private async emitEvent(
    topic: LaneBusEventTopic,
    laneId: string,
    workspaceId: string,
    fromState: LaneState,
    toState: LaneState,
  ): Promise<void> {
    if (!this.bus) return;

    const envelope: LocalBusEnvelope = {
      id: `${laneId}:${topic}:${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: workspaceId,
      lane_id: laneId,
      topic,
      payload: {
        laneId,
        workspaceId,
        fromState,
        toState,
        correlationId: laneId,
      },
    };

    try {
      await this.bus.publish(envelope);
    } catch {
      // T004: Bus failures do not block lane operations (fire-and-forget)
    }
  }
}

// Re-export public types
export { LaneRegistry, type LaneRecord, LaneNotFoundError } from "./registry.js";
export type { LaneState, LaneEvent } from "./state_machine.js";
export { InvalidLaneTransitionError, transition, withLaneLock, getTransitionHistory } from "./state_machine.js";
export { LaneClosedError, SharedLaneCleanupError } from "./sharing.js";
