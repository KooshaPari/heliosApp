import type { PtyRegistry, ReconciliationSummary } from "./registry.js";

const DEFAULT_SHELL_PATTERNS = ["bash", "zsh", "sh", "fish"];

export function collectOrphanPidsFromPsOutput(
  output: string,
  currentPid: number,
  shellPatterns: string[] = DEFAULT_SHELL_PATTERNS,
  trackedPids: ReadonlySet<number> = new Set()
): number[] {
  const orphanPids: number[] = [];
  const lines = output.trim().split("\n").slice(1);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) {
      continue;
    }

    const pid = Number.parseInt(parts[0]!, 10);
    const ppid = Number.parseInt(parts[1]!, 10);
    const comm = parts.slice(2).join(" ");

    if (Number.isNaN(pid) || Number.isNaN(ppid)) {
      continue;
    }

    if (ppid !== currentPid && ppid !== 1) {
      continue;
    }

    const basename = comm.split("/").pop() ?? "";
    const isShell = shellPatterns.some(
      pattern => basename === pattern || basename === `-${pattern}`
    );

    if (isShell && !trackedPids.has(pid)) {
      orphanPids.push(pid);
    }
  }

  return orphanPids;
}

export async function reconcileRegistryOrphans(
  registry: PtyRegistry,
  shellPatterns: string[] = DEFAULT_SHELL_PATTERNS,
  gracePeriodMs = 5000
): Promise<ReconciliationSummary> {
  const start = performance.now();
  let found = 0;
  let reattached = 0;
  let terminated = 0;
  let errors = 0;

  try {
    const orphanPids = await scanForOrphans(registry, shellPatterns);
    found = orphanPids.length;

    for (const pid of orphanPids) {
      try {
        const existingRecord = registry.list().find(record => record.pid === pid);
        if (existingRecord) {
          reattached++;
          continue;
        }

        await terminateOrphan(pid, gracePeriodMs);
        terminated++;
      } catch {
        errors++;
      }
    }
  } catch {
    errors++;
  }

  return {
    found,
    reattached,
    terminated,
    errors,
    durationMs: performance.now() - start,
  };
}

async function scanForOrphans(registry: PtyRegistry, shellPatterns: string[]): Promise<number[]> {
  const currentPid = process.pid;

  try {
    const proc = Bun.spawn(["ps", "-eo", "pid,ppid,comm"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const trackedPids = new Set(registry.list().map(record => record.pid));
    return collectOrphanPidsFromPsOutput(output, currentPid, shellPatterns, trackedPids);
  } catch {
    return [];
  }
}

async function terminateOrphan(pid: number, gracePeriodMs: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, gracePeriodMs));

  try {
    process.kill(pid, 0);
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
}
