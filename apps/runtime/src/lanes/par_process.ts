import type { LaneRegistry } from "./registry.js";
import type { ParBinding, SpawnResult } from "./par_types.js";
import { isProcessAlive } from "./par_types.js";

type EmitParEvent = (
  topic: string,
  laneId: string,
  workspaceId: string,
  extra: Record<string, unknown>,
) => Promise<void>;

type TerminateManagedParTaskInput = {
  laneId: string;
  bindings: Map<string, ParBinding>;
  processHandles: Map<string, SpawnResult>;
  registry: LaneRegistry;
  forceKillTimeoutMs: number;
  emitParEvent: EmitParEvent;
};

type RunParHealthCheckInput = {
  bindings: Map<string, ParBinding>;
  processHandles: Map<string, SpawnResult>;
  registry: LaneRegistry;
  staleTimeoutMs: number;
  emitParEvent: EmitParEvent;
  terminateParTask: (laneId: string) => Promise<void>;
};

export async function terminateManagedParTask(
  input: TerminateManagedParTaskInput,
): Promise<void> {
  const { laneId, bindings, processHandles, registry, forceKillTimeoutMs, emitParEvent } = input;
  const binding = bindings.get(laneId);
  if (!binding) {
    return;
  }

  if (binding.status === "terminated") {
    bindings.delete(laneId);
    processHandles.delete(laneId);
    registry.update(laneId, { parTaskPid: null });
    return;
  }

  const proc = processHandles.get(laneId);
  const lane = registry.get(laneId);
  const workspaceId = lane?.workspaceId ?? "";

  if (proc) {
    try {
      proc.kill(15);
    } catch {
      // Process may already be gone.
    }

    const exited = await Promise.race([
      proc.exited.then(() => true).catch(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), forceKillTimeoutMs)),
    ]);

    if (!exited) {
      try {
        proc.kill(9);
      } catch {
        // Process may already be gone.
      }
      await emitParEvent("lane.par_task.force_killed", laneId, workspaceId, {
        parTaskId: binding.parTaskId,
        pid: binding.pid,
      });
    }
  }

  binding.status = "terminated";
  bindings.delete(laneId);
  processHandles.delete(laneId);
  registry.update(laneId, { parTaskPid: null });

  await emitParEvent("lane.par_task.terminated", laneId, workspaceId, {
    parTaskId: binding.parTaskId,
    pid: binding.pid,
    reason: "cleanup",
  });
}

export async function runParHealthCheck(input: RunParHealthCheckInput): Promise<void> {
  const {
    bindings,
    processHandles,
    registry,
    staleTimeoutMs,
    emitParEvent,
    terminateParTask,
  } = input;

  for (const [laneId, binding] of bindings) {
    if (binding.status !== "active") {
      continue;
    }

    const lane = registry.get(laneId);
    const workspaceId = lane?.workspaceId ?? "";

    if (!isProcessAlive(binding.pid)) {
      binding.status = "terminated";
      bindings.delete(laneId);
      processHandles.delete(laneId);
      registry.update(laneId, { parTaskPid: null });

      await emitParEvent("lane.par_task.terminated", laneId, workspaceId, {
        parTaskId: binding.parTaskId,
        pid: binding.pid,
        reason: "dead_process_detected",
      });
      continue;
    }

    const elapsed = Date.now() - binding.lastHeartbeat.getTime();
    if (elapsed <= staleTimeoutMs) {
      continue;
    }

    binding.status = "stale";

    await emitParEvent("lane.par_task.stale", laneId, workspaceId, {
      parTaskId: binding.parTaskId,
      pid: binding.pid,
      elapsedMs: elapsed,
    });

    await terminateParTask(laneId);

    await emitParEvent("lane.par_task.force_killed", laneId, workspaceId, {
      parTaskId: binding.parTaskId,
      pid: binding.pid,
      reason: "stale_timeout",
    });
  }
}
