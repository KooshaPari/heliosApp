// T001 - Watchdog checkpoint persistence for crash recovery

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface WatchdogCheckpoint {
  cycleNumber: number;
  lastCycleTimestamp: string;
  orphanCount: number;
  detectionSummary: {
    worktrees: number;
    zellijSessions: number;
    ptyProcesses: number;
  };
}

export class CheckpointManager {
  private readonly checkpointPath: string;

  constructor(baseDir?: string) {
    const heliosDataDir = baseDir ?? path.join(os.homedir(), ".helios", "data");
    this.checkpointPath = path.join(heliosDataDir, "watchdog_checkpoint.json");
  }

  async save(checkpoint: WatchdogCheckpoint): Promise<void> {
    const dir = path.dirname(this.checkpointPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  async load(): Promise<WatchdogCheckpoint | null> {
    try {
      const content = await fs.readFile(this.checkpointPath, "utf-8");
      const checkpoint = JSON.parse(content) as WatchdogCheckpoint;
      return checkpoint;
    } catch (_error) {
      // File doesn't exist or is corrupt - return null for fresh start
      return null;
    }
  }

  async delete(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
    } catch {
      // File doesn't exist - no action needed
    }
  }
}
