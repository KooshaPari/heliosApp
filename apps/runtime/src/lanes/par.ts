import type { LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import { executeCommandInLane } from "./par_execution.js";
import { runParHealthCheck, terminateManagedParTask } from "./par_process.js";
import {
  type ExecResult,
  type ParBinding,
  type ParManagerOptions,
  ParSpawnError,
  type SpawnFn,
  type SpawnResult,
  defaultSpawn,
  generateParTaskId,
  resetParIdCounter,
} from "./par_types.js";
import type { LaneRegistry } from "./registry.js";

export class ParManager {
  private readonly bindings = new Map<string, ParBinding>();
  private readonly registry: LaneRegistry;
  private readonly bus: LocalBus | null;
  private readonly staleTimeoutMs: number;
  private readonly forceKillTimeoutMs: number;
  private readonly healthCheckIntervalMs: number;
  private readonly execTimeoutMs: number;
  private readonly spawnFn: SpawnFn;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  // Track live process handles for termination
  private readonly processHandles = new Map<string, SpawnResult>();

  constructor(options: ParManagerOptions) {
    this.registry = options.registry;
    this.bus = options.bus ?? null;
    this.staleTimeoutMs = options.staleTimeoutMs ?? 30_000;
    this.forceKillTimeoutMs = options.forceKillTimeoutMs ?? 10_000;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 15_000;
    this.execTimeoutMs = options.execTimeoutMs ?? 300_000;
    this.spawnFn = options.spawnFn ?? defaultSpawn;
  }

  // ── T011: Bind par task to lane ─────────────────────────────────────────

  async bindParTask(laneId: string, worktreePath: string): Promise<ParBinding> {
    const lane = this.registry.get(laneId);
    if (!lane) {
      throw new ParSpawnError(laneId, "Lane not found");
    }

    const parTaskId = generateParTaskId();
    let proc: SpawnResult;

    try {
      proc = this.spawnFn(["par", "task", "create", "--cwd", worktreePath], {
        cwd: worktreePath,
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (err) {
      throw new ParSpawnError(laneId, err instanceof Error ? err.message : String(err));
    }

    const pid = proc.pid;
    if (!pid || pid <= 0) {
      throw new ParSpawnError(laneId, "Failed to capture par process PID");
    }

    const now = new Date();
    const binding: ParBinding = {
      laneId,
      parTaskId,
      pid,
      worktreePath,
      startedAt: now,
      status: "active",
      lastHeartbeat: now,
    };

    this.bindings.set(laneId, binding);
    this.processHandles.set(laneId, proc);

    // Update lane record with par PID
    this.registry.update(laneId, { parTaskPid: pid });

    // Monitor for unexpected exit
    proc.exited
      .then(exitCode => {
        const current = this.bindings.get(laneId);
        if (current && current.status === "active") {
          current.status = "terminated";
          this.registry.update(laneId, { parTaskPid: null });
          this.processHandles.delete(laneId);
          this.emitParEvent("lane.par_task.terminated", laneId, lane.workspaceId, {
            parTaskId,
            pid,
            exitCode,
            reason: "unexpected_exit",
          });
        }
      })
      .catch(() => {
        // Process monitoring failed - will be caught by health check
      });

    await this.emitParEvent("lane.par_task.bound", laneId, lane.workspaceId, {
      parTaskId,
      pid,
      worktreePath,
    });

    return binding;
  }

  // ── T012: Terminate par task ────────────────────────────────────────────

  async terminateParTask(laneId: string): Promise<void> {
    await terminateManagedParTask({
      laneId,
      bindings: this.bindings,
      processHandles: this.processHandles,
      registry: this.registry,
      forceKillTimeoutMs: this.forceKillTimeoutMs,
      emitParEvent: this.emitParEvent.bind(this),
    });
  }

  // ── T013: Execute command in lane ───────────────────────────────────────

  async executeInLane(laneId: string, command: string[]): Promise<ExecResult> {
    return executeCommandInLane({
      laneId,
      command,
      registry: this.registry,
      bindings: this.bindings,
      spawnFn: this.spawnFn,
      execTimeoutMs: this.execTimeoutMs,
      emitParEvent: this.emitParEvent.bind(this),
    });
  }

  // ── T014: Stale detection and health check ──────────────────────────────

  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }
    this.healthCheckTimer = setInterval(() => {
      this.runHealthCheck().catch(() => {
        // Health check error - will retry next cycle
      });
    }, this.healthCheckIntervalMs);
  }

  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async runHealthCheck(): Promise<void> {
    await runParHealthCheck({
      bindings: this.bindings,
      processHandles: this.processHandles,
      registry: this.registry,
      staleTimeoutMs: this.staleTimeoutMs,
      emitParEvent: this.emitParEvent.bind(this),
      terminateParTask: this.terminateParTask.bind(this),
    });
  }

  /** Update heartbeat for a par binding (e.g. from par's heartbeat signal). */
  updateHeartbeat(laneId: string): void {
    const binding = this.bindings.get(laneId);
    if (binding && binding.status === "active") {
      binding.lastHeartbeat = new Date();
    }
  }

  // ── Accessors ─────────────────────────────────────────────────────────

  getBinding(laneId: string): ParBinding | undefined {
    const b = this.bindings.get(laneId);
    return b ? { ...b } : undefined;
  }

  getAllBindings(): ParBinding[] {
    return [...this.bindings.values()].map(b => ({ ...b }));
  }

  // ── Event Publishing ──────────────────────────────────────────────────

  private async emitParEvent(
    topic: string,
    laneId: string,
    workspaceId: string,
    extra: Record<string, unknown>
  ): Promise<void> {
    if (!this.bus) {
      return;
    }

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
        timestamp: new Date().toISOString(),
        correlationId: laneId,
        ...extra,
      },
    };

    try {
      await this.bus.publish(envelope);
    } catch {
      // Bus failures do not block par operations
    }
  }
}

export function _resetParIdCounter(): void {
  resetParIdCounter();
}

export {
  ParNotFoundError,
  ParSpawnError,
  LaneNotReadyError,
  ExecTimeoutError,
} from "./par_types.js";

export type {
  ParBinding,
  ExecResult,
  ParManagerOptions,
  SpawnFn,
  SpawnResult,
} from "./par_types.js";
