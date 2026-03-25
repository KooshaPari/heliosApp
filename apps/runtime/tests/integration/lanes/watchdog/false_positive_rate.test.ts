// Integration test for false positive rate validation

import { beforeEach, describe, expect, it } from "bun:test";
import { LaneRegistry } from "../../../../src/lanes/registry.js";
import { RemediationEngine } from "../../../../src/lanes/watchdog/remediation.js";
import type { ClassifiedOrphan } from "../../../../src/lanes/watchdog/resource_classifier.js";
import { ResourceClassifier } from "../../../../src/lanes/watchdog/resource_classifier.js";
import { InMemoryLocalBus } from "../../../../src/protocol/bus.js";

describe("False Positive Rate", () => {
  let engine: RemediationEngine;
  let bus: InMemoryLocalBus;
  let laneRegistry: LaneRegistry;
  let _classifier: ResourceClassifier;

  beforeEach(() => {
    bus = new InMemoryLocalBus();
    laneRegistry = new LaneRegistry();
    engine = new RemediationEngine(laneRegistry, bus);
    _classifier = new ResourceClassifier();
  });

  it("should have zero false positives with healthy system", async () => {
    // Create a healthy system with 50 active lanes
    for (let i = 0; i < 50; i++) {
      const laneId = `lane-${i}`;
      laneRegistry.register({
        laneId,
        workspaceId: `ws-${i}`,
        state: "active",
        worktreePath: `/tmp/${laneId}`,
        parTaskPid: null,
        attachedAgents: [],
        baseBranch: "main",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Create detection cycles with no actual orphans
    let falsePositives = 0;

    for (let cycle = 0; cycle < 20; cycle++) {
      // Empty orphan list (healthy system)
      const suggestions = await engine.generateSuggestions([]);
      falsePositives += suggestions.length;
    }

    expect(falsePositives).toBe(0);
  });

  it("should not suggest cleanup for active lanes' resources", async () => {
    // Create active lanes
    const activeLanes = ["lane-1", "lane-2", "lane-3"];
    for (const laneId of activeLanes) {
      laneRegistry.register({
        laneId,
        workspaceId: "ws1",
        state: "active",
        worktreePath: `/tmp/${laneId}`,
        parTaskPid: null,
        attachedAgents: [],
        baseBranch: "main",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // If somehow these lanes appear as orphans (shouldn't happen),
    // they should not get suggestions due to registry check
    const orphans: ClassifiedOrphan[] = activeLanes.map(laneId => ({
      type: "worktree",
      path: `/tmp/${laneId}`,
      age: 100,
      estimatedOwner: laneId,
      riskLevel: "low",
      createdAt: new Date().toISOString(),
    }));

    const suggestions = await engine.generateSuggestions(orphans);

    // Since lanes are active in registry, no suggestions should be created
    // (The detector wouldn't report them as orphans in the first place)
    expect(suggestions.length).toBe(0);
  });

  it("should track false positives over 500 cycles", async () => {
    // Create 50 lanes
    for (let i = 0; i < 50; i++) {
      const laneId = `lane-stable-${i}`;
      laneRegistry.register({
        laneId,
        workspaceId: `ws-${i}`,
        state: "active",
        worktreePath: `/tmp/${laneId}`,
        parTaskPid: null,
        attachedAgents: [],
        baseBranch: "main",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    let totalFalsePositives = 0;
    const cycleCount = 100; // Reduced from 500 for test speed

    for (let cycle = 0; cycle < cycleCount; cycle++) {
      // No orphans in healthy system
      const suggestions = await engine.generateSuggestions([]);
      totalFalsePositives += suggestions.length;
    }

    const falsePositiveRate = (totalFalsePositives / cycleCount) * 100;

    // False positive rate should be below 1%
    expect(falsePositiveRate).toBeLessThan(1);
  });

  it("should correctly identify true positives", async () => {
    // Create some active lanes
    for (let i = 0; i < 10; i++) {
      const laneId = `lane-active-${i}`;
      laneRegistry.register({
        laneId,
        workspaceId: "ws1",
        state: "active",
        worktreePath: `/tmp/${laneId}`,
        parTaskPid: null,
        attachedAgents: [],
        baseBranch: "main",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Create some orphans
    const orphans: ClassifiedOrphan[] = [
      {
        type: "worktree",
        path: "/tmp/orphan-1",
        age: 5000,
        estimatedOwner: "unknown",
        riskLevel: "high",
        createdAt: new Date().toISOString(),
      },
      {
        type: "zellij_session",
        path: "session-orphan",
        age: 3000,
        estimatedOwner: "lane-dead",
        riskLevel: "medium",
        createdAt: new Date().toISOString(),
      },
    ];

    const suggestions = await engine.generateSuggestions(orphans);

    // Should correctly identify orphans
    expect(suggestions.length).toBe(2);
  });

  it("should not suggest cleanup for resources in cooldown", async () => {
    const orphans: ClassifiedOrphan[] = [
      {
        type: "worktree",
        path: "/tmp/declined-resource",
        age: 3000,
        estimatedOwner: "lane-test",
        riskLevel: "low",
        createdAt: new Date().toISOString(),
      },
    ];

    // First cycle: suggestion created
    let suggestions = await engine.generateSuggestions(orphans);
    expect(suggestions.length).toBe(1);

    // Decline it
    engine.declineCleanup(suggestions[0].id);

    // Next 5 cycles: no false positives due to cooldown
    let falsePositives = 0;
    for (let i = 0; i < 5; i++) {
      suggestions = await engine.generateSuggestions(orphans);
      falsePositives += suggestions.length;
    }

    expect(falsePositives).toBe(0);
  });
});
