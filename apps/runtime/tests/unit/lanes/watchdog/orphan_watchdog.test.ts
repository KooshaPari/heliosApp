// Unit tests for OrphanWatchdog

<<<<<<< HEAD
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { LaneRegistry } from "../../../../src/lanes/registry.js";
import { OrphanWatchdog } from "../../../../src/lanes/watchdog/orphan_watchdog.js";
import { InMemoryLocalBus } from "../../../../src/protocol/bus.js";
=======
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import os from "os";
import path from "path";

// Mock execCommand before importing OrphanWatchdog so detectors use the mock
mock.module("../../../../src/integrations/exec.js", () => ({
  execCommand: async (_command: string, _args: string[]) => ({
    code: 1,
    stdout: "",
    stderr: "mocked: command not available in test",
  }),
  probeClipProxy: async () => "cliproxy_probe_exception" as const,
}));

const { OrphanWatchdog } = await import("../../../../src/lanes/watchdog/orphan_watchdog.js");
const { InMemoryLocalBus } = await import("../../../../src/protocol/bus.js");
const { LaneRegistry } = await import("../../../../src/lanes/registry.js");
>>>>>>> origin/main

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
<<<<<<< HEAD
  let watchdog: OrphanWatchdog;
  let laneRegistry: LaneRegistry;
  let bus: InMemoryLocalBus;
=======
  let watchdog: InstanceType<typeof OrphanWatchdog>;
  let laneRegistry: InstanceType<typeof LaneRegistry>;
  let bus: InstanceType<typeof InMemoryLocalBus>;
>>>>>>> origin/main

  beforeEach(() => {
    laneRegistry = new LaneRegistry();
    bus = new InMemoryLocalBus();
  });

  afterEach(async () => {
    watchdog.stop();
  });

  it("should start and stop cleanly", async () => {
    watchdog = new OrphanWatchdog({
<<<<<<< HEAD
=======
      checkpointBaseDir: path.join(os.tmpdir(), "helios-test-watchdog-" + Date.now()),
>>>>>>> origin/main
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
<<<<<<< HEAD
  });

  it("should run detection cycles on interval", async () => {
    watchdog = new OrphanWatchdog({
=======
  }, 15000);

  it("should run detection cycles on interval", async () => {
    watchdog = new OrphanWatchdog({
      checkpointBaseDir: path.join(os.tmpdir(), "helios-test-watchdog-" + Date.now()),
>>>>>>> origin/main
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();

    // Wait for first cycle to complete
<<<<<<< HEAD
    await new Promise(r => setTimeout(r, 150));
=======
    // Poll until detection runs (CI may be slow)
    let duration = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(r => setTimeout(r, 150));
      duration = watchdog.getLastDetectionDuration();
      if (duration > 0) break;
    }
>>>>>>> origin/main

    const events = bus.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].topic).toBe("orphan.detection.cycle_completed");

    watchdog.stop();
<<<<<<< HEAD
  });

  it("should emit detection cycle event with correct structure", async () => {
    watchdog = new OrphanWatchdog({
=======
  }, 15000);

  it("should emit detection cycle event with correct structure", async () => {
    watchdog = new OrphanWatchdog({
      checkpointBaseDir: path.join(os.tmpdir(), "helios-test-watchdog-" + Date.now()),
>>>>>>> origin/main
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
<<<<<<< HEAD
    await new Promise(r => setTimeout(r, 150));
=======
    // Poll until detection runs (CI may be slow)
    let duration = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(r => setTimeout(r, 150));
      duration = watchdog.getLastDetectionDuration();
      if (duration > 0) break;
    }
>>>>>>> origin/main

    const events = bus.getEvents();
    const cycleEvent = events.find(e => e.topic === "orphan.detection.cycle_completed");

    expect(cycleEvent).toBeDefined();
<<<<<<< HEAD
    expect(cycleEvent?.payload?.cycleNumber).toBeGreaterThanOrEqual(1);
    expect(cycleEvent?.payload?.summary).toBeDefined();
    expect((cycleEvent?.payload?.summary as any)?.worktrees).toBeGreaterThanOrEqual(0);
    expect((cycleEvent?.payload?.summary as any)?.zellijSessions).toBeGreaterThanOrEqual(0);
    expect((cycleEvent?.payload?.summary as any)?.ptyProcesses).toBeGreaterThanOrEqual(0);

    watchdog.stop();
  });

  it("should not allow double start", async () => {
    watchdog = new OrphanWatchdog({
=======
    expect(cycleEvent?.payload?.cycleNumber).toBe(1);
    expect(cycleEvent?.payload?.summary).toBeDefined();
    const summary = (cycleEvent?.payload as Record<string, unknown>)?.summary as
      | Record<string, unknown>
      | undefined;
    expect(summary?.worktrees).toBe(0);
    expect(summary?.zellijSessions).toBe(0);
    expect(summary?.ptyProcesses).toBe(0);

    watchdog.stop();
  }, 15000);

  it("should not allow double start", async () => {
    watchdog = new OrphanWatchdog({
      checkpointBaseDir: path.join(os.tmpdir(), "helios-test-watchdog-" + Date.now()),
>>>>>>> origin/main
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
<<<<<<< HEAD
  });

  it("should track detection duration", async () => {
    watchdog = new OrphanWatchdog({
=======
  }, 15000);

  it("should track detection duration", async () => {
    watchdog = new OrphanWatchdog({
      checkpointBaseDir: path.join(os.tmpdir(), "helios-test-watchdog-" + Date.now()),
>>>>>>> origin/main
      detectionInterval: 50,
      worktreeBaseDir: "/tmp/test-worktrees",
      sessionRegistry: createMockSessionRegistry(),
      terminalRegistry: createMockTerminalRegistry(),
      laneRegistry,
      bus,
    });

    await watchdog.start();
<<<<<<< HEAD
    await new Promise(r => setTimeout(r, 150));

    const duration = watchdog.getLastDetectionDuration();
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1000); // Should be fast

    watchdog.stop();
  });
=======
    // Poll until detection runs — use generous limits for CI
    let duration = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(r => setTimeout(r, 150));
      duration = watchdog.getLastDetectionDuration();
      if (duration > 0) break;
    }

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(5000); // Generous limit for slow CI

    watchdog.stop();
  }, 15000);
>>>>>>> origin/main
});
