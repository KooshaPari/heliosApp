// Unit tests for OrphanWatchdog

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { LaneRegistry } from "../../../../src/lanes/registry.js";
import { OrphanWatchdog } from "../../../../src/lanes/watchdog/orphan_watchdog.js";
import { InMemoryLocalBus } from "../../../../src/protocol/bus.js";

// Mock registries
const createMockSessionRegistry = () => ({
  getSession: () => null,
  getSessions: () => [],
});

const createMockTerminalRegistry = () => ({
  getTerminal: () => null,
  getTerminals: () => [],
});

describe("OrphanWatchdog", () => {
  let watchdog: OrphanWatchdog;
  let laneRegistry: LaneRegistry;
  let bus: InMemoryLocalBus;

  beforeEach(() => {
    laneRegistry = new LaneRegistry();
    bus = new InMemoryLocalBus();
  });

  afterEach(async () => {
    watchdog.stop();
  });

  it("should start and stop cleanly", async () => {
    watchdog = new OrphanWatchdog({
      detectionInterval: 100,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
    expect(watchdog).toBeDefined();

    watchdog.stop();
    // Give time for any pending callbacks
    await new Promise(r => setTimeout(r, 150));

    // After stop, detection duration should be set
    expect(watchdog.getLastDetectionDuration()).toBeGreaterThanOrEqual(0);
  });

  it("should run detection cycles on interval", async () => {
    watchdog = new OrphanWatchdog({
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();

    // Wait for first cycle to complete
    await new Promise(r => setTimeout(r, 150));

    const events = bus.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].topic).toBe("orphan.detection.cycle_completed");

    watchdog.stop();
  });

  it("should emit detection cycle event with correct structure", async () => {
    watchdog = new OrphanWatchdog({
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
    await new Promise(r => setTimeout(r, 150));

    const events = bus.getEvents();
    const cycleEvent = events.find(e => e.topic === "orphan.detection.cycle_completed");

    expect(cycleEvent).toBeDefined();
    expect(cycleEvent?.payload?.cycleNumber).toBe(1);
    expect(cycleEvent?.payload?.summary).toBeDefined();
    expect((cycleEvent?.payload?.summary as any)?.worktrees).toBe(0);
    expect((cycleEvent?.payload?.summary as any)?.zellijSessions).toBe(0);
    expect((cycleEvent?.payload?.summary as any)?.ptyProcesses).toBe(0);

    watchdog.stop();
  });

  it("should not allow double start", async () => {
    watchdog = new OrphanWatchdog({
      detectionInterval: 100,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
    expect(watchdog).toBeDefined();

    // Second start should warn but not fail
    await watchdog.start();

    watchdog.stop();
  });

  it("should track detection duration", async () => {
    watchdog = new OrphanWatchdog({
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
    await new Promise(r => setTimeout(r, 150));

    const duration = watchdog.getLastDetectionDuration();
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1000); // Should be fast

    watchdog.stop();
  });
});
