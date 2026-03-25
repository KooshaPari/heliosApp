import type { LocalBus } from "../protocol/bus.js";
import type { LaneRegistry } from "./registry.js";

export interface ParBinding {
  laneId: string;
  parTaskId: string;
  pid: number;
  worktreePath: string;
  startedAt: Date;
  status: "active" | "stale" | "terminated";
  lastHeartbeat: Date;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export type SpawnFn = (
  cmd: string[],
  opts: { cwd?: string; stdout?: "pipe"; stderr?: "pipe" },
) => SpawnResult;

export interface SpawnResult {
  pid: number;
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill(signal?: number): void;
}

export interface ParManagerOptions {
  registry: LaneRegistry;
  bus?: LocalBus | null;
  staleTimeoutMs?: number;
  forceKillTimeoutMs?: number;
  healthCheckIntervalMs?: number;
  execTimeoutMs?: number;
  spawnFn?: SpawnFn;
}

export class ParNotFoundError extends Error {
  constructor(public readonly laneId: string) {
    super(`No par binding found for lane ${laneId}`);
    this.name = "ParNotFoundError";
  }
}

export class ParSpawnError extends Error {
  constructor(
    public readonly laneId: string,
    public readonly reason: string,
  ) {
    super(`Par spawn failed for lane ${laneId}: ${reason}`);
    this.name = "ParSpawnError";
  }
}

export class LaneNotReadyError extends Error {
  constructor(
    public readonly laneId: string,
    public readonly state: string,
  ) {
    super(`Lane ${laneId} is not ready for execution (state: ${state})`);
    this.name = "LaneNotReadyError";
  }
}

export class ExecTimeoutError extends Error {
  constructor(
    public readonly laneId: string,
    public readonly timeoutMs: number,
  ) {
    super(`Command execution timed out in lane ${laneId} after ${timeoutMs}ms`);
    this.name = "ExecTimeoutError";
  }
}

let parIdCounter = 0;

export function generateParTaskId(): string {
  parIdCounter += 1;
  return `par_${Date.now()}_${parIdCounter.toString(36)}`;
}

export function resetParIdCounter(): void {
  parIdCounter = 0;
}

export function defaultSpawn(
  cmd: string[],
  opts: { cwd?: string; stdout?: "pipe"; stderr?: "pipe" },
): SpawnResult {
  const bunRuntime = (globalThis as Record<string, unknown>).Bun as
    | {
        spawn(command: string[], options: { cwd?: string; stdout?: "pipe"; stderr?: "pipe" }): SpawnResult;
      }
    | undefined;
  if (!bunRuntime) {
    throw new Error("ParManager requires Bun runtime");
  }

  const proc = bunRuntime.spawn(cmd, {
    cwd: opts.cwd,
    stdout: opts.stdout ?? "pipe",
    stderr: opts.stderr ?? "pipe",
  });
  return {
    pid: proc.pid,
    stdout: proc.stdout as ReadableStream<Uint8Array> | null,
    stderr: proc.stderr as ReadableStream<Uint8Array> | null,
    exited: proc.exited,
    kill(signal?: number) {
      proc.kill(signal);
    },
  };
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
