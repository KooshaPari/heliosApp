import { describe, expect, test } from "bun:test";
import { CleanupExecutor } from "../cleanup_executor.js";
import type { ClassifiedOrphan } from "../resource_classifier.js";

describe("CleanupExecutor", () => {
  test("returns a stable error for worktree cleanup without a path", async () => {
    const executor = new CleanupExecutor();
    const orphan: ClassifiedOrphan = {
      type: "worktree",
      age: 1000,
      estimatedOwner: "lane-1",
      riskLevel: "high",
      createdAt: new Date().toISOString(),
    };

    const result = await executor.executeCleanup(orphan);
    expect(result).toEqual({
      resourceId: "unknown",
      success: false,
      message: "Worktree path not available",
      resourceType: "worktree",
    });
  });

  test("returns a stable error for zellij session cleanup without a session name", async () => {
    const executor = new CleanupExecutor();
    const orphan: ClassifiedOrphan = {
      type: "zellij_session",
      age: 1000,
      estimatedOwner: "lane-1",
      riskLevel: "medium",
      createdAt: new Date().toISOString(),
    };

    const result = await executor.executeCleanup(orphan);
    expect(result).toEqual({
      resourceId: "unknown",
      success: false,
      message: "Session name not available",
      resourceType: "zellij_session",
    });
  });

  test("returns a stable error for PTY cleanup without a PID", async () => {
    const executor = new CleanupExecutor();
    const orphan: ClassifiedOrphan = {
      type: "pty_process",
      age: 1000,
      estimatedOwner: "lane-1",
      riskLevel: "low",
      createdAt: new Date().toISOString(),
    };

    const result = await executor.executeCleanup(orphan);
    expect(result).toEqual({
      resourceId: "undefined",
      success: false,
      message: "Process PID not available",
      resourceType: "pty_process",
    });
  });
});
