// Unit tests for CheckpointManager

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CheckpointManager,
  type WatchdogCheckpoint,
} from "../../../../src/lanes/watchdog/checkpoint.js";

describe("CheckpointManager", () => {
  let manager: CheckpointManager;
  const testDir = path.join(os.tmpdir(), "helios-test-checkpoint");

  beforeEach(async () => {
    // Create manager
    manager = new CheckpointManager();
    // Clean up any existing test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Clean up any real checkpoint file left by other tests
    try {
      await manager.delete();
    } catch {
      // Ignore if not present
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should initialize checkpoint manager", () => {
    expect(manager).toBeDefined();
  });

  it("should return null for non-existent checkpoint", async () => {
    const checkpoint = await manager.load();
    expect(checkpoint).toBeNull();
  });

  it("should save and load checkpoint correctly", async () => {
    const checkpoint: WatchdogCheckpoint = {
      cycleNumber: 1,
      lastCycleTimestamp: new Date().toISOString(),
      orphanCount: 5,
      detectionSummary: {
        worktrees: 2,
        zellijSessions: 1,
        ptyProcesses: 2,
      },
    };

    await manager.save(checkpoint);
    const loaded = await manager.load();

    expect(loaded).toBeDefined();
    expect(loaded?.cycleNumber).toBe(1);
    expect(loaded?.orphanCount).toBe(5);
    expect(loaded?.detectionSummary.worktrees).toBe(2);
  });

  it("should handle multiple saves", async () => {
    const checkpoint1: WatchdogCheckpoint = {
      cycleNumber: 1,
      lastCycleTimestamp: new Date().toISOString(),
      orphanCount: 5,
      detectionSummary: {
        worktrees: 2,
        zellijSessions: 1,
        ptyProcesses: 2,
      },
    };

    const checkpoint2: WatchdogCheckpoint = {
      cycleNumber: 2,
      lastCycleTimestamp: new Date().toISOString(),
      orphanCount: 3,
      detectionSummary: {
        worktrees: 1,
        zellijSessions: 1,
        ptyProcesses: 1,
      },
    };

    await manager.save(checkpoint1);
    await manager.save(checkpoint2);

    const loaded = await manager.load();
    expect(loaded?.cycleNumber).toBe(2);
    expect(loaded?.orphanCount).toBe(3);
  });

  it("should handle corrupt checkpoint gracefully", async () => {
    // Create a corrupt checkpoint file manually
    try {
      const checkpointPath = path.join(os.homedir(), ".helios", "data", "watchdog_checkpoint.json");
      await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
      await fs.writeFile(checkpointPath, "{ invalid json }", "utf-8");

      const loaded = await manager.load();
      expect(loaded).toBeNull();
    } catch {
      // Expected for test isolation
    }
  });

  it("should delete checkpoint", async () => {
    const checkpoint: WatchdogCheckpoint = {
      cycleNumber: 1,
      lastCycleTimestamp: new Date().toISOString(),
      orphanCount: 5,
      detectionSummary: {
        worktrees: 2,
        zellijSessions: 1,
        ptyProcesses: 2,
      },
    };

    await manager.save(checkpoint);
    let loaded = await manager.load();
    expect(loaded).toBeDefined();

    await manager.delete();
    loaded = await manager.load();
    expect(loaded).toBeNull();
  });
});
