import type { LaneRegistry } from "./registry.js";
import { reconcileOrphanedWorktrees } from "./worktree.js";
import type { PtyManager } from "./cleanup.js";

export interface FullReconciliationResult {
  orphanedWorktrees: number;
  orphanedRecords: number;
  orphanedParTasks: number;
  orphanedPtys: number;
  totalCleaned: number;
  cleaned: number;
  timedOut: boolean;
}

export interface LaneReconciliationOptions {
  emitReconciliationEvent: (result: FullReconciliationResult) => Promise<void>;
  ptyManager: PtyManager | null;
  registry: LaneRegistry;
  timeoutMs: number;
  workspaceRepoPath: string;
}

export async function reconcileLaneOrphans(
  options: LaneReconciliationOptions,
): Promise<FullReconciliationResult> {
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
  const isTimedOut = (): boolean => Date.now() - startTime >= options.timeoutMs;

  try {
    const activeLanes = options.registry.getActive();
    const knownLaneIds = new Set(activeLanes.map((lane) => lane.laneId));

    if (!isTimedOut()) {
      const worktreeResult = await reconcileOrphanedWorktrees(
        options.workspaceRepoPath,
        knownLaneIds,
        (laneId: string) => {
          try {
            options.registry.update(laneId, { state: "closed" });
          } catch {
            // Lane may not exist in the registry anymore.
          }
        },
      );
      result.orphanedWorktrees = worktreeResult.orphanedWorktrees;
      result.cleaned += worktreeResult.cleaned;
      result.totalCleaned += worktreeResult.cleaned;
    }

    if (!isTimedOut()) {
      const fsModule = await import("node:fs");
      for (const lane of activeLanes) {
        if (isTimedOut()) {
          break;
        }
        if (lane.worktreePath && !fsModule.existsSync(lane.worktreePath)) {
          result.orphanedRecords += 1;
          result.totalCleaned += 1;
          options.registry.update(lane.laneId, { state: "closed", worktreePath: null });
        }
      }
    }

    if (!isTimedOut()) {
      for (const lane of options.registry.list()) {
        if (isTimedOut()) {
          break;
        }
        if (lane.parTaskPid !== null && lane.state !== "closed") {
          try {
            process.kill(lane.parTaskPid, 0);
          } catch {
            result.orphanedParTasks += 1;
            result.totalCleaned += 1;
            options.registry.update(lane.laneId, { parTaskPid: null });
          }
        }
      }
    }

    if (!isTimedOut() && options.ptyManager) {
      const closedLanes = options.registry.list().filter((lane) => lane.state === "closed");
      for (const lane of closedLanes) {
        if (isTimedOut()) {
          break;
        }
        try {
          const ptys = options.ptyManager.getByLane(lane.laneId);
          for (const pty of ptys) {
            result.orphanedPtys += 1;
            result.totalCleaned += 1;
            try {
              await options.ptyManager.terminate(pty.ptyId);
            } catch {
              // Best-effort; orphan scanning should not stop on PTY failures.
            }
          }
        } catch {
          // Ignore PTY manager failures during reconciliation.
        }
      }
    }
  } catch {
    // Partial reconciliation is still reported via the returned counters.
  }

  result.timedOut = isTimedOut();
  await options.emitReconciliationEvent(result);
  return result;
}
