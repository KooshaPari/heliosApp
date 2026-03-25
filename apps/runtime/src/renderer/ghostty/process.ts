/**
 * Ghostty process lifecycle manager (T002).
 *
 * Manages spawning, stopping, crash detection, and restart of the
 * ghostty terminal emulator process.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GhosttySpawn = {
  pid: number;
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill(signal?: string): void;
};

function spawnGhosttyProcess(
  command: string[],
  options: {
    env?: Record<string, string>;
    stdout: "pipe";
    stderr: "pipe";
  },
): GhosttySpawn {
  const bunRuntime = (globalThis as Record<string, unknown>).Bun as
    | {
        spawn(
          cmd: string[],
          opts: {
            env?: Record<string, string>;
            stdout: "pipe";
            stderr: "pipe";
          },
        ): GhosttySpawn;
      }
    | undefined;
  if (!bunRuntime) {
    throw new Error("Ghostty process management requires Bun runtime");
  }
  return bunRuntime.spawn(command, options);
}

function toSpawnEnv(
  env: NodeJS.ProcessEnv,
  overrides?: Record<string, string> | undefined,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }
  if (overrides !== undefined) {
    for (const [key, value] of Object.entries(overrides)) {
      merged[key] = value;
    }
  }
  return merged;
}

export interface GhosttyOptions {
  /** Path to the ghostty binary. Defaults to "ghostty". */
  binaryPath?: string | undefined;
  /** Window ID for surface binding. */
  windowId?: string | undefined;
  /** Additional CLI arguments. */
  extraArgs?: string[] | undefined;
  /** Environment variables to pass to the ghostty process. */
  env?: Record<string, string> | undefined;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GhosttyBinaryNotFoundError extends Error {
  constructor(path: string) {
    super(
      `Ghostty binary not found at "${path}". ` +
        "Ensure ghostty is installed and the path is correct.",
    );
    this.name = "GhosttyBinaryNotFoundError";
  }
}

export class GhosttyProcessError extends Error {
  constructor(message: string, public readonly exitCode?: number | undefined) {
    super(message);
    this.name = "GhosttyProcessError";
  }
}

// ---------------------------------------------------------------------------
// Process manager
// ---------------------------------------------------------------------------

const SIGTERM_TIMEOUT_MS = 5_000;

export class GhosttyProcess {
  private _proc: GhosttySpawn | undefined;
  private _pid: number | undefined;
  private _running = false;
  private _intentionalStop = false;
  private _startedAt: number | undefined;
  private _crashHandler: ((error: Error) => void) | undefined;
  private _lastOptions: GhosttyOptions | undefined;
  private _restartMutex = false;

  /** Whether the ghostty process is currently running. */
  isRunning(): boolean {
    return this._running;
  }

  /** PID of the running process, or undefined. */
  getPid(): number | undefined {
    return this._pid;
  }

  /** Uptime in milliseconds, or 0 if not running. */
  getUptime(): number {
    if (this._startedAt === undefined) return 0;
    return Date.now() - this._startedAt;
  }

  /** Register a crash handler. Last-wins semantics. */
  onCrash(handler: (error: Error) => void): void {
    this._crashHandler = handler;
  }

  /**
   * Start the ghostty process.
   *
   * @returns The PID of the spawned process.
   * @throws {GhosttyBinaryNotFoundError} if the binary cannot be found.
   */
  async start(options: GhosttyOptions = {}): Promise<{ pid: number }> {
    if (this._running) {
      throw new GhosttyProcessError("Ghostty process is already running");
    }

    const binaryPath = options.binaryPath ?? "ghostty";
    this._lastOptions = options;
    this._intentionalStop = false;

    // Verify binary exists
    try {
      const which = spawnGhosttyProcess(["which", binaryPath], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await which.exited;
      if (exitCode !== 0) {
        throw new GhosttyBinaryNotFoundError(binaryPath);
      }
    } catch (e) {
      if (e instanceof GhosttyBinaryNotFoundError) throw e;
      throw new GhosttyBinaryNotFoundError(binaryPath);
    }

    // Build args
    const args: string[] = [binaryPath];
    if (options.windowId !== undefined) {
      args.push("--window-id", options.windowId);
    }
    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }

    const proc = spawnGhosttyProcess(args, {
      stdout: "pipe",
      stderr: "pipe",
      env: toSpawnEnv(process.env, options.env),
    });

    this._proc = proc;
    this._pid = proc.pid;
    this._running = true;
    this._startedAt = Date.now();

    // Monitor for unexpected exit (crash detection)
    void proc.exited.then((exitCode) => {
      this._running = false;
      if (!this._intentionalStop) {
        const error = new GhosttyProcessError(
          `Ghostty process exited unexpectedly with code ${exitCode}`,
          exitCode,
        );
        // Fire crash handler within 500ms budget (this is near-immediate)
        this._crashHandler?.(error);
      }
    });

    return { pid: proc.pid };
  }

  /**
   * Stop the ghostty process gracefully.
   *
   * Sends SIGTERM, waits up to 5s, then escalates to SIGKILL.
   */
  async stop(): Promise<void> {
    if (!this._running || this._proc === undefined) {
      // Idempotent: already stopped
      return;
    }

    this._intentionalStop = true;

    // SIGTERM
    this._proc.kill("SIGTERM");

    // Wait for graceful exit or timeout
    const exitPromise = this._proc.exited;
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), SIGTERM_TIMEOUT_MS),
    );

    const result = await Promise.race([exitPromise, timeoutPromise]);

    if (result === "timeout") {
      // Escalate to SIGKILL
      this._proc.kill("SIGKILL");
      await this._proc.exited;
    }

    this._running = false;
    this._proc = undefined;
    this._pid = undefined;
    this._startedAt = undefined;
  }

  /**
   * Restart the process with the same options.
   *
   * Serialised: concurrent restart calls are no-ops while one is in progress.
   */
  async restart(): Promise<{ pid: number }> {
    if (this._restartMutex) {
      throw new GhosttyProcessError("Restart already in progress");
    }

    this._restartMutex = true;
    try {
      await this.stop();
      return await this.start(this._lastOptions ?? {});
    } finally {
      this._restartMutex = false;
    }
  }
}
