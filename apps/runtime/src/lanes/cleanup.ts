import * as path from "node:path";
import type { LaneRecord, LaneRegistry } from "./registry.js";
import { SharedLaneCleanupError } from "./sharing.js";
import { type LaneState, recordTransition, transition } from "./state_machine.js";
import { removeWorktree } from "./worktree.js";

export interface PtyHandle {
  ptyId: string;
  laneId: string;
}

export interface PtyManager {
  getByLane(laneId: string): PtyHandle[];
  terminate(ptyId: string): Promise<void>;
}

type CleanupEventTopic =
  | "lane.cleaning"
  | "lane.closed"
  | "lane.ptys_terminated"
  | "lane.worktree.removed";

type EmitLaneEvent = (
  topic: CleanupEventTopic,
  laneId: string,
  workspaceId: string,
  fromState: LaneState,
  toState: LaneState
) => Promise<void>;

export interface LaneCleanupOptions {
  emitEvent: EmitLaneEvent;
  force?: boolean;
  laneId: string;
  ptyManager: PtyManager | null;
  ptyTerminationTimeoutMs: number;
  registry: LaneRegistry;
}

export async function cleanupLane(options: LaneCleanupOptions): Promise<void> {
  const lane = options.registry.get(options.laneId);
  if (!lane || lane.state === "closed") {
    return;
  }

  if (lane.state === "cleaning") {
    await closeCleaningLane(options.registry, options.emitEvent, lane);
    return;
  }

  await transitionLaneToCleaning(options, lane);
  await terminateLanePtys(options, lane.workspaceId);
  await removeLaneWorktree(options, lane.workspaceId);
  await closeCleaningLane(
    options.registry,
    options.emitEvent,
    options.registry.get(options.laneId)!
  );
}

async function transitionLaneToCleaning(
  options: LaneCleanupOptions,
  lane: LaneRecord
): Promise<void> {
  if (lane.state === "shared" && lane.attachedAgents.length > 0) {
    if (!options.force) {
      throw new SharedLaneCleanupError(options.laneId, lane.attachedAgents.length);
    }

    options.registry.update(options.laneId, { attachedAgents: [] });
    const readyState = transition(lane.state, "unshare", options.laneId);
    recordTransition(options.laneId, lane.state, "unshare", readyState);
    options.registry.update(options.laneId, { state: readyState });

    const cleaningState = transition(readyState, "request_cleanup", options.laneId);
    recordTransition(options.laneId, readyState, "request_cleanup", cleaningState);
    options.registry.update(options.laneId, { state: cleaningState });
    await options.emitEvent(
      "lane.cleaning",
      options.laneId,
      lane.workspaceId,
      lane.state,
      cleaningState
    );
    return;
  }

  const cleaningState = transition(lane.state, "request_cleanup", options.laneId);
  recordTransition(options.laneId, lane.state, "request_cleanup", cleaningState);
  options.registry.update(options.laneId, { state: cleaningState });
  await options.emitEvent(
    "lane.cleaning",
    options.laneId,
    lane.workspaceId,
    lane.state,
    cleaningState
  );
}

async function terminateLanePtys(options: LaneCleanupOptions, workspaceId: string): Promise<void> {
  if (!options.ptyManager) {
    return;
  }

  let ptys: PtyHandle[];
  try {
    ptys = options.ptyManager.getByLane(options.laneId);
  } catch {
    return;
  }

  if (ptys.length === 0) {
    return;
  }

  await Promise.all(
    ptys.map(async pty => {
      try {
        const timeout = new Promise<"timeout">(resolve =>
          setTimeout(() => resolve("timeout"), options.ptyTerminationTimeoutMs)
        );
        const termination = options.ptyManager?.terminate(pty.ptyId).then(() => "done" as const);
        await Promise.race([termination, timeout]);
      } catch {
        // Best-effort; cleanup continues even if PTY termination fails.
      }
    })
  );

  await options.emitEvent(
    "lane.ptys_terminated",
    options.laneId,
    workspaceId,
    "cleaning",
    "cleaning"
  );
}

async function removeLaneWorktree(options: LaneCleanupOptions, workspaceId: string): Promise<void> {
  const lane = options.registry.get(options.laneId);
  if (!lane?.worktreePath) {
    return;
  }

  try {
    const worktreeParent = path.dirname(lane.worktreePath);
    const workspaceRepoPath = path.dirname(worktreeParent);
    await removeWorktree(lane.worktreePath, workspaceRepoPath);
    await options.emitEvent(
      "lane.worktree.removed",
      options.laneId,
      workspaceId,
      "cleaning",
      "cleaning"
    );
  } catch {
    // Best-effort; the worktree may already be gone.
  }

  options.registry.update(options.laneId, { worktreePath: null });
}

async function closeCleaningLane(
  registry: LaneRegistry,
  emitEvent: EmitLaneEvent,
  lane: LaneRecord
): Promise<void> {
  const closedState = transition(lane.state, "cleanup_complete", lane.laneId);
  recordTransition(lane.laneId, lane.state, "cleanup_complete", closedState);
  registry.update(lane.laneId, { state: closedState });
  await emitEvent("lane.closed", lane.laneId, lane.workspaceId, lane.state, closedState);
}
