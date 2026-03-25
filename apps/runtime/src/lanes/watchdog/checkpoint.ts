// T001 - Watchdog checkpoint persistence for crash recovery

<<<<<<< HEAD
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
=======
import { promises as fs } from "fs";
import path from "path";
import os from "os";
>>>>>>> origin/main

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

<<<<<<< HEAD
  constructor() {
    const heliosDataDir = path.join(os.homedir(), ".helios", "data");
=======
  constructor(baseDir?: string) {
    const heliosDataDir = baseDir ?? path.join(os.homedir(), ".helios", "data");
>>>>>>> origin/main
    this.checkpointPath = path.join(heliosDataDir, "watchdog_checkpoint.json");
  }

  async save(checkpoint: WatchdogCheckpoint): Promise<void> {
<<<<<<< HEAD
    const dir = path.dirname(this.checkpointPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
=======
    try {
      const dir = path.dirname(this.checkpointPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      console.error("Failed to save checkpoint:", error);
      throw error;
    }
>>>>>>> origin/main
  }

  async load(): Promise<WatchdogCheckpoint | null> {
    try {
      const content = await fs.readFile(this.checkpointPath, "utf-8");
      const checkpoint = JSON.parse(content) as WatchdogCheckpoint;
      return checkpoint;
<<<<<<< HEAD
    } catch (_error) {
=======
    } catch (error) {
>>>>>>> origin/main
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
