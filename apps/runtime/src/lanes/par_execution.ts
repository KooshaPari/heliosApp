import type { ExecResult, ParBinding, SpawnFn } from "./par_types.js";
import { ExecTimeoutError, LaneNotReadyError, ParNotFoundError } from "./par_types.js";
import type { LaneRegistry } from "./registry.js";
import { type LaneState, recordTransition, transition, withLaneLock } from "./state_machine.js";

type ExecuteCommandInLaneInput = {
  laneId: string;
  command: string[];
  registry: LaneRegistry;
  bindings: Map<string, ParBinding>;
  spawnFn: SpawnFn;
  execTimeoutMs: number;
  emitParEvent: (
    topic: string,
    laneId: string,
    workspaceId: string,
    extra: Record<string, unknown>
  ) => Promise<void>;
};

function restoreReadyState(registry: LaneRegistry, laneId: string): void {
  const currentLane = registry.get(laneId);
  if (!currentLane || currentLane.state !== "running") {
    return;
  }

  const readyState = transition("running", "command_complete", laneId);
  recordTransition(laneId, "running", "command_complete", readyState);
  registry.update(laneId, { state: readyState });
}

export async function executeCommandInLane(input: ExecuteCommandInLaneInput): Promise<ExecResult> {
  const { laneId, command, registry, bindings, spawnFn, execTimeoutMs, emitParEvent } = input;

  return withLaneLock(laneId, async () => {
    const lane = registry.get(laneId);
    if (!lane) {
      throw new LaneNotReadyError(laneId, "not_found");
    }

    if (lane.state !== "ready" && lane.state !== "shared") {
      throw new LaneNotReadyError(laneId, lane.state);
    }

    const binding = bindings.get(laneId);
    if (!binding || binding.status !== "active") {
      throw new ParNotFoundError(laneId);
    }

    const fromState = lane.state as LaneState;
    const runningState = transition(fromState, "start_running", laneId);
    recordTransition(laneId, fromState, "start_running", runningState);
    registry.update(laneId, { state: runningState });

    await emitParEvent("lane.command.started", laneId, lane.workspaceId, {
      command,
      parTaskId: binding.parTaskId,
    });

    const start = performance.now();

    try {
      const proc = spawnFn(["par", "exec", "--task", binding.parTaskId, "--", ...command], {
        cwd: binding.worktreePath,
        stdout: "pipe",
        stderr: "pipe",
      });

      const timeoutPromise = new Promise<"timeout">(resolve =>
        setTimeout(() => resolve("timeout"), execTimeoutMs)
      );

      const result = await Promise.race([
        proc.exited.then(code => ({ type: "done" as const, code })),
        timeoutPromise.then(() => ({ type: "timeout" as const, code: -1 })),
      ]);

      if (result.type === "timeout") {
        try {
          proc.kill(9);
        } catch {
          // Process may already be gone.
        }

        restoreReadyState(registry, laneId);

        await emitParEvent("lane.command.timeout", laneId, lane.workspaceId, {
          command,
          timeoutMs: execTimeoutMs,
        });

        throw new ExecTimeoutError(laneId, execTimeoutMs);
      }

      const [stdout, stderr] = await Promise.all([
        proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
        proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
      ]);

      const duration = performance.now() - start;
      restoreReadyState(registry, laneId);

      const execResult: ExecResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: result.code,
        duration,
      };

      await emitParEvent("lane.command.completed", laneId, lane.workspaceId, {
        command,
        exitCode: result.code,
        duration,
      });

      return execResult;
    } catch (error) {
      if (error instanceof ExecTimeoutError) {
        throw error;
      }

      try {
        restoreReadyState(registry, laneId);
      } catch {
        // Lane reset is best-effort during unexpected failures.
      }
      throw error;
    }
  });
}
