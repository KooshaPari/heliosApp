import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execCommand } from "../../integrations/exec.js";
import type { ClassifiedOrphan, ResourceType } from "./resource_classifier.js";

export interface CleanupResult {
  resourceId: string;
  success: boolean;
  message: string;
  resourceType: ResourceType;
}

export class CleanupExecutor {
  async executeCleanup(orphan: ClassifiedOrphan): Promise<CleanupResult> {
    try {
      switch (orphan.type) {
        case "worktree":
          return await this.cleanupWorktree(orphan);
        case "zellij_session":
          return await this.cleanupZellijSession(orphan);
        case "pty_process":
          return await this.cleanupPtyProcess(orphan);
        default:
          return {
            resourceId: orphan.path || String(orphan.pid),
            success: false,
            message: `Unknown resource type: ${orphan.type}`,
            resourceType: orphan.type,
          };
      }
    } catch (error) {
      return {
        resourceId: orphan.path || String(orphan.pid),
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        resourceType: orphan.type,
      };
    }
  }

  private async cleanupWorktree(orphan: ClassifiedOrphan): Promise<CleanupResult> {
    if (!orphan.path) {
      return {
        resourceId: "unknown",
        success: false,
        message: "Worktree path not available",
        resourceType: "worktree",
      };
    }

    try {
      await this.snapshotWorktree(orphan);
      const result = await execCommand("git", ["worktree", "remove", orphan.path]);

      if (result.code === 0) {
        return {
          resourceId: orphan.path,
          success: true,
          message: "Worktree removed successfully",
          resourceType: "worktree",
        };
      }

      return {
        resourceId: orphan.path,
        success: false,
        message: `git worktree remove failed: ${result.stderr}`,
        resourceType: "worktree",
      };
    } catch (error) {
      return {
        resourceId: orphan.path,
        success: false,
        message: `Worktree cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        resourceType: "worktree",
      };
    }
  }

  private async snapshotWorktree(orphan: ClassifiedOrphan): Promise<void> {
    if (!orphan.path) {
      return;
    }

    const snapshotDir = path.join(os.homedir(), ".helios", "data", "worktree_snapshots");
    await fs.mkdir(snapshotDir, { recursive: true });

    const snapshotName = `${Date.now()}-${orphan.estimatedOwner}.json`;
    const snapshotPath = path.join(snapshotDir, snapshotName);

    const snapshot = {
      timestamp: new Date().toISOString(),
      path: orphan.path,
      estimatedOwner: orphan.estimatedOwner,
      metadata: orphan.metadata,
      age: orphan.age,
    };

    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  }

  private async cleanupZellijSession(orphan: ClassifiedOrphan): Promise<CleanupResult> {
    if (!orphan.path) {
      return {
        resourceId: "unknown",
        success: false,
        message: "Session name not available",
        resourceType: "zellij_session",
      };
    }

    try {
      const result = await execCommand("zellij", ["kill-session", orphan.path]);

      if (result.code === 0) {
        return {
          resourceId: orphan.path,
          success: true,
          message: "Zellij session terminated",
          resourceType: "zellij_session",
        };
      }

      return {
        resourceId: orphan.path,
        success: false,
        message: `zellij kill-session failed: ${result.stderr}`,
        resourceType: "zellij_session",
      };
    } catch (error) {
      return {
        resourceId: orphan.path,
        success: false,
        message: `Session cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        resourceType: "zellij_session",
      };
    }
  }

  private async cleanupPtyProcess(orphan: ClassifiedOrphan): Promise<CleanupResult> {
    if (!orphan.pid) {
      return {
        resourceId: String(orphan.pid),
        success: false,
        message: "Process PID not available",
        resourceType: "pty_process",
      };
    }

    try {
      const killResult = await execCommand("kill", ["-TERM", String(orphan.pid)]);

      if (killResult.code === 0 || killResult.code === 1) {
        await this.sleep(1000);
        const checkResult = await execCommand("kill", ["-0", String(orphan.pid)]);

        if (checkResult.code !== 0) {
          return {
            resourceId: String(orphan.pid),
            success: true,
            message: "Process terminated gracefully",
            resourceType: "pty_process",
          };
        }

        const killResult2 = await execCommand("kill", ["-KILL", String(orphan.pid)]);

        if (killResult2.code === 0 || killResult2.code === 1) {
          return {
            resourceId: String(orphan.pid),
            success: true,
            message: "Process killed forcefully",
            resourceType: "pty_process",
          };
        }

        return {
          resourceId: String(orphan.pid),
          success: false,
          message: "Failed to terminate process",
          resourceType: "pty_process",
        };
      }

      return {
        resourceId: String(orphan.pid),
        success: false,
        message: "SIGTERM failed",
        resourceType: "pty_process",
      };
    } catch (error) {
      return {
        resourceId: String(orphan.pid),
        success: false,
        message: `Process cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        resourceType: "pty_process",
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
