/**
 * T001 - Zellij CLI wrapper with version detection.
 *
 * Provides a typed, testable interface for zellij CLI operations
 * using Bun.spawn for process execution.
 */

<<<<<<< HEAD
import { ZellijNotFoundError, ZellijTimeoutError, ZellijVersionError } from "./errors.js";
import type { AvailabilityResult, CliResult, ZellijSession } from "./types.js";
=======
import type { AvailabilityResult, CliResult, ZellijSession } from "./types.js";
import {
  ZellijNotFoundError,
  ZellijVersionError,
  ZellijCliError,
  ZellijTimeoutError,
} from "./errors.js";
>>>>>>> origin/main

const DEFAULT_TIMEOUT_MS = 10_000;
const MINIMUM_VERSION = "0.40.0";

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
<<<<<<< HEAD
    if (va < vb) {
      return -1;
    }
    if (va > vb) {
      return 1;
    }
=======
    if (va < vb) return -1;
    if (va > vb) return 1;
>>>>>>> origin/main
  }
  return 0;
}

export class ZellijCli {
  private readonly zellijPath: string;
  private readonly defaultTimeout: number;

  constructor(options?: { zellijPath?: string; defaultTimeout?: number }) {
    this.zellijPath = options?.zellijPath ?? "zellij";
    this.defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Run a zellij CLI command with optional timeout.
   */
  async run(args: string[], options?: { timeout?: number }): Promise<CliResult> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const command = `${this.zellijPath} ${args.join(" ")}`;
    const startMs = performance.now();

<<<<<<< HEAD
    let proc: any;
    try {
      proc = (Bun as any).spawn([this.zellijPath, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch {
      throw new ZellijNotFoundError();
    }

    // Race between process completion and timeout
    const timeoutPromise = new Promise<"timeout">(resolve =>
      setTimeout(() => {
        resolve("timeout");
      }, timeout)
    );

    const exitPromise = proc.exited.then(() => "done" as const);
    const race = await Promise.race([exitPromise, timeoutPromise]);
=======
    let proc: ReturnType<typeof Bun.spawn>;
    try {
      proc = Bun.spawn([this.zellijPath, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (error) {
      const caught = error as { code?: string; message?: string };
      if (caught?.code === "ENOENT" || caught?.message?.includes("spawn ENOENT")) {
        throw new ZellijNotFoundError();
      }
      throw error;
    }

    // Race between process completion and timeout
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<"timeout">(resolve => {
      timer = setTimeout(() => {
        resolve("timeout");
      }, timeout);
    });

    const exitPromise = proc.exited.then(() => "done" as const);
    const race = await Promise.race([exitPromise, timeoutPromise]);
    if (timer) {
      clearTimeout(timer);
    }
>>>>>>> origin/main

    if (race === "timeout") {
      proc.kill();
      throw new ZellijTimeoutError(command, timeout);
    }

    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout as ReadableStream).arrayBuffer(),
      new Response(proc.stderr as ReadableStream).arrayBuffer(),
      proc.exited,
    ]);

<<<<<<< HEAD
    const _durationMs = performance.now() - startMs;
    const stdout = new TextDecoder().decode(stdoutBuf);
    const stderr = new TextDecoder().decode(stderrBuf);

=======
    const durationMs = performance.now() - startMs;
    const stdout = new TextDecoder().decode(stdoutBuf);
    const stderr = new TextDecoder().decode(stderrBuf);

    // Debug logging for all CLI calls
    console.debug(
      `[zellij-cli] ${command} -> exit=${exitCode} duration=${durationMs.toFixed(1)}ms`
    );

>>>>>>> origin/main
    return { stdout, stderr, exitCode };
  }

  /**
   * Check zellij availability and version.
   */
  async checkAvailability(): Promise<AvailabilityResult> {
    let result: CliResult;
    try {
      result = await this.run(["--version"], { timeout: 5_000 });
    } catch (err) {
      if (err instanceof ZellijNotFoundError) {
        return { available: false };
      }
      throw err;
    }

    if (result.exitCode !== 0) {
      return { available: false };
    }

    // Parse version from output like "zellij 0.41.2"
    const versionMatch = result.stdout.trim().match(/(\d+\.\d+\.\d+)/);
    if (!versionMatch?.[1]) {
      return { available: false };
    }

    const version = versionMatch[1];

    if (compareSemver(version, MINIMUM_VERSION) < 0) {
      throw new ZellijVersionError(version, MINIMUM_VERSION);
    }

<<<<<<< HEAD
    // Attempt to resolve the binary path
    let path: string | undefined;
    try {
      const whichResult = await this.run(["--version"], { timeout: 2_000 });
      if (whichResult.exitCode === 0) {
        path = this.zellijPath;
      }
    } catch {
      // path stays undefined, which is fine
    }
=======
    const path = this.zellijPath;
>>>>>>> origin/main

    return { available: true, version, path };
  }

  /**
   * List all zellij sessions, parsed into typed records.
   */
  async listSessions(): Promise<ZellijSession[]> {
    const result = await this.run(["list-sessions"]);

<<<<<<< HEAD
    // If no sessions, zellij may return exit code 0 with empty output
    // or exit code 1 with "No active zellij sessions found."
    if (result.exitCode !== 0 && result.stdout.includes("No active")) {
      return [];
    }

    if (result.exitCode !== 0 && result.stdout.trim() === "" && result.stderr.trim() === "") {
=======
    if (
      result.exitCode !== 0 &&
      (result.stdout.includes("No active") || result.stdout.trim() === "")
    ) {
>>>>>>> origin/main
      return [];
    }

    const lines = result.stdout.trim().split("\n").filter(Boolean);
    const sessions: ZellijSession[] = [];

    for (const line of lines) {
      const parsed = this.parseSessionLine(line);
      if (parsed !== undefined) {
        sessions.push(parsed);
      }
    }

    return sessions;
  }

  /**
   * Parse a single line from `zellij list-sessions` output.
   * Format varies but typically: "session-name [Created ...ago] (ATTACHED)" or similar.
   */
  private parseSessionLine(line: string): ZellijSession | undefined {
    const trimmed = line.trim();
<<<<<<< HEAD
    if (trimmed === "") {
      return undefined;
    }
=======
    if (trimmed === "") return undefined;
>>>>>>> origin/main

    // The session name is the first whitespace-delimited token
    const parts = trimmed.split(/\s+/);
    const name = parts[0];
<<<<<<< HEAD
    if (!name) {
      return undefined;
    }
=======
    if (!name) return undefined;
>>>>>>> origin/main

    const attached = /\(ATTACHED\)/i.test(trimmed) || trimmed.includes("ATTACHED");

    // Try to extract creation date/time if present; otherwise use now
    const dateMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    const created = dateMatch ? new Date(`${dateMatch[1]}T${dateMatch[2]}`) : new Date();

    return { name, created, attached };
  }
}
