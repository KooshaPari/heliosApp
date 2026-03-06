import { randomUUID } from "node:crypto";
import type { ProtocolBus as LocalBus } from "../protocol/bus.js";

export interface OrphanItem {
  type: "pty" | "zellij_session" | "par_lane" | "share_worker" | "temp_file";
  id: string;
  description: string;
  pid?: number;
  path?: string;
}

export interface OrphanReport {
  safeToTerminate: OrphanItem[];
  needsReview: OrphanItem[];
  totalFound: number;
}

export interface CleanupResult {
  terminated: number;
  removed: number;
  reviewPending: number;
}

export class OrphanReconciler {
  private bus?: LocalBus | undefined;
  private restoredSessionIds: Set<string>;

  constructor(restoredSessionIds: string[], bus?: LocalBus) {
    this.restoredSessionIds = new Set(restoredSessionIds);
    this.bus = bus;
  }

  async scan(): Promise<OrphanReport> {
    const safeToTerminate: OrphanItem[] = [];
    const needsReview: OrphanItem[] = [];

    // Scan for orphan PTY processes
    await this.scanOrphanPtys(safeToTerminate, needsReview);

    // Scan for stale zellij sessions
    await this.scanStaleZelijjSessions(safeToTerminate, needsReview);

    // Scan for stale temp files
    await this.scanStaleTempFiles(safeToTerminate, needsReview);

    const totalFound = safeToTerminate.length + needsReview.length;

    return {
      safeToTerminate,
      needsReview,
      totalFound,
    };
  }

  async cleanup(report: OrphanReport): Promise<CleanupResult> {
    let terminated = 0;
    let removed = 0;

    // Terminate safe-to-terminate processes
    for (const item of report.safeToTerminate) {
      const cleanupResult = await this.cleanupItem(item);
      terminated += cleanupResult.terminated;
      removed += cleanupResult.removed;
    }

    const reviewPending = report.needsReview.length;

    // Publish cleanup event
    if (this.bus) {
      await this.bus.publish({
        id: randomUUID(),
        type: "event",
        ts: new Date().toISOString(),
        topic: "recovery.orphans.cleaned",
        payload: {
          terminated,
          removed,
          reviewPending,
        },
      });
    }

    return {
      terminated,
      removed,
      reviewPending,
    };
  }

  private async scanOrphanPtys(
    _safeToTerminate: OrphanItem[],
    _needsReview: OrphanItem[]
  ): Promise<void> {
    // In a real implementation, this would scan /proc or use Bun/Node APIs
    // to find PTY processes owned by heliosApp but not associated with restored sessions
    // For now, this is a no-op
  }

  private async scanStaleZelijjSessions(
    _safeToTerminate: OrphanItem[],
    _needsReview: OrphanItem[]
  ): Promise<void> {
    // In a real implementation, this would call zellij list-sessions
    // and compare against restored session IDs
    // For now, this is a no-op
  }

  private async cleanupItem(item: OrphanItem): Promise<{ terminated: number; removed: number }> {
    if (item.type === "temp_file" && item.path) {
      try {
        const { promises: fs } = await import("node:fs");
        await fs.unlink(item.path);
        return { terminated: 0, removed: 1 };
      } catch {
        return { terminated: 0, removed: 0 };
      }
    }

    if (
      (item.type === "pty" || item.type === "zellij_session" || item.type === "share_worker") &&
      item.pid
    ) {
      return this.cleanupProcess(item.pid);
    }

    return { terminated: 0, removed: 0 };
  }

  private cleanupProcess(pid: number): Promise<{ terminated: number; removed: number }> {
    return new Promise(resolve => {
      try {
        // Try SIGTERM first
        process.kill(pid, "SIGTERM");

        // Wait 3s for graceful shutdown
        setTimeout(() => {
          let terminated = 1;

          // Check if process is still alive
          try {
            process.kill(pid, 0);
            // Still alive, force SIGKILL
            process.kill(pid, "SIGKILL");
          } catch {
            // Process is dead
            terminated = 0;
          }

          resolve({ terminated, removed: 0 });
        }, 3000);
      } catch {
        resolve({ terminated: 0, removed: 0 });
      }
    });
  }

  private async scanStaleTempFiles(
    safeToTerminate: OrphanItem[],
    _needsReview: OrphanItem[]
  ): Promise<void> {
    try {
      const { promises: fs } = await import("node:fs");
      const path = await import("node:path");

      // Look for stale temp files in recovery directory
      // This is a simplified version; real implementation would be more thorough
      const recoveryDir = path.join(process.cwd(), "recovery");
      try {
        const files = await fs.readdir(recoveryDir);
        for (const file of files) {
          if (file.endsWith(".tmp")) {
            const filePath = path.join(recoveryDir, file);
            safeToTerminate.push({
              type: "temp_file",
              id: file,
              description: `Stale temp file: ${file}`,
              path: filePath,
            });
          }
        }
      } catch {
        // Recovery directory doesn't exist
      }
    } catch (_error) {
      // Ignore temp file scan failures; they do not block recovery.
    }
  }
}
