import type { LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import type { LaneState } from "./state_machine.js";

export type LaneBusEventTopic =
  | "lane.created"
  | "lane.state.changed"
  | "lane.shared"
  | "lane.cleaning"
  | "lane.closed"
  | "lane.ptys_terminated"
  | "lane.worktree.provisioned"
  | "lane.worktree.removed"
  | "lane.provision_failed"
  | "reconciliation.completed";

export async function publishLaneEvent(
  bus: LocalBus,
  topic: LaneBusEventTopic,
  laneId: string,
  workspaceId: string,
  fromState: LaneState,
  toState: LaneState
): Promise<void> {
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
    const directEventSink = bus as LocalBus & {
      pushEvent?: (event: LocalBusEnvelope) => void;
    };
    if (typeof directEventSink.pushEvent === "function") {
      directEventSink.pushEvent(envelope);
      return;
    }
    await bus.publish(envelope);
  } catch {
    // Fire-and-forget.
  }
}

export async function publishReconciliationEvent(
  bus: LocalBus,
  result: {
    orphanedWorktrees: number;
    orphanedRecords: number;
    orphanedParTasks: number;
    orphanedPtys: number;
    totalCleaned: number;
    timedOut: boolean;
  }
): Promise<void> {
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

  try {
    await bus.publish(envelope);
  } catch {
    // Fire-and-forget.
  }
}
