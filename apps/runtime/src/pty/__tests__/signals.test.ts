<<<<<<< HEAD
import { afterEach, describe, expect, it } from "bun:test";
import { InMemoryBusPublisher } from "../events.js";
import { PtyRegistry } from "../registry.js";
import type { PtyRecord } from "../registry.js";
import {
  InvalidDimensionsError,
  SignalHistory,
  resize,
  sendSighup,
  terminate,
} from "../signals.js";
import type { SignalHistoryMap } from "../signals.js";
import { PtyLifecycle } from "../state_machine.js";
=======
import { describe, expect, it } from "bun:test";
import {
  resize,
  terminate,
  sendSighup,
  SignalHistory,
  InvalidDimensionsError,
} from "../signals.js";
import type { SignalHistoryMap } from "../signals.js";
import { PtyRegistry } from "../registry.js";
import type { PtyRecord } from "../registry.js";
import { PtyLifecycle } from "../state_machine.js";
import { InMemoryBusPublisher } from "../events.js";
>>>>>>> origin/main

function makeRecord(overrides?: Partial<PtyRecord>): PtyRecord {
  return {
    ptyId: "pty-test-1",
    laneId: "lane-1",
    sessionId: "session-1",
    terminalId: "term-1",
<<<<<<< HEAD
    pid: 99999, // non-existent PID — avoids signalling the test runner
=======
    pid: 99999,
>>>>>>> origin/main
    state: "active",
    dimensions: { cols: 80, rows: 24 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    env: Object.freeze({}),
    ...overrides,
  };
}

<<<<<<< HEAD
=======
function spawnShellProcess(): number {
  const proc = Bun.spawn(["/bin/sh"], {
    stdout: "pipe",
    stderr: "pipe",
  }) as { pid?: number };

  if (proc.pid === undefined) {
    throw new Error("Bun.spawn did not return a process ID");
  }

  return proc.pid;
}

const pidsToCleanup: number[] = [];

>>>>>>> origin/main
describe("SignalHistory", () => {
  it("stores and retrieves envelopes", () => {
    const history = new SignalHistory(3);
    history.add({
      ptyId: "p1",
      signal: "SIGTERM",
      timestamp: 1,
      outcome: "delivered",
      pid: 1,
    });
    history.add({
      ptyId: "p1",
      signal: "SIGKILL",
      timestamp: 2,
      outcome: "escalated",
      pid: 1,
    });
    expect(history.length).toBe(2);
<<<<<<< HEAD
    expect(history.getAll()[0]?.signal).toBe("SIGTERM");
=======
    expect(history.getAll()[0]!.signal).toBe("SIGTERM");
>>>>>>> origin/main
  });

  it("bounds history to maxRecords", () => {
    const history = new SignalHistory(2);
    history.add({
      ptyId: "p1",
      signal: "SIGWINCH",
      timestamp: 1,
      outcome: "delivered",
      pid: 1,
    });
    history.add({
      ptyId: "p1",
      signal: "SIGTERM",
      timestamp: 2,
      outcome: "delivered",
      pid: 1,
    });
    history.add({
      ptyId: "p1",
      signal: "SIGKILL",
      timestamp: 3,
      outcome: "escalated",
      pid: 1,
    });
    expect(history.length).toBe(2);
<<<<<<< HEAD
    expect(history.getAll()[0]?.signal).toBe("SIGTERM");
=======
    expect(history.getAll()[0]!.signal).toBe("SIGTERM");
>>>>>>> origin/main
  });
});

describe("resize", () => {
<<<<<<< HEAD
  const pidsToCleanup: number[] = [];

  afterEach(() => {
    for (const pid of pidsToCleanup) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
    pidsToCleanup.length = 0;
  });

  it("updates dimensions and emits events", () => {
    // Spawn a real child so SIGWINCH delivery succeeds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    } as any) as any;
    pidsToCleanup.push(proc.pid as number);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid: proc.pid as number });
=======
  it("updates dimensions and emits events", () => {
    // Spawn a real child so SIGWINCH delivery succeeds.
    const pid = spawnShellProcess();
    pidsToCleanup.push(pid);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid });
>>>>>>> origin/main
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    resize(record, 120, 40, registry, historyMap, bus);

    const updated = registry.get(record.ptyId);
    expect(updated?.dimensions).toEqual({ cols: 120, rows: 40 });

    const topics = bus.events.map(e => e.topic);
    expect(topics).toContain("pty.signal.delivered");
    expect(topics).toContain("pty.resized");

    // Check resize event payload includes old/new dimensions.
    const resizeEvt = bus.events.find(e => e.topic === "pty.resized");
<<<<<<< HEAD
    expect(resizeEvt?.payload.oldDimensions).toEqual({
      cols: 80,
      rows: 24,
    });
    expect(resizeEvt?.payload.newDimensions).toEqual({
=======
    expect(resizeEvt?.payload["oldDimensions"]).toEqual({
      cols: 80,
      rows: 24,
    });
    expect(resizeEvt?.payload["newDimensions"]).toEqual({
>>>>>>> origin/main
      cols: 120,
      rows: 40,
    });
  });

  it("rejects invalid dimensions", () => {
    const registry = new PtyRegistry();
    const record = makeRecord();
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    expect(() => resize(record, 0, 24, registry, historyMap, bus)).toThrow(InvalidDimensionsError);
    expect(() => resize(record, 80, 0, registry, historyMap, bus)).toThrow(InvalidDimensionsError);
    expect(() => resize(record, 10001, 24, registry, historyMap, bus)).toThrow(
      InvalidDimensionsError
    );
  });

  it("rejects resize on errored PTY", () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ state: "errored" });
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    expect(() => resize(record, 80, 24, registry, historyMap, bus)).toThrow("Cannot resize");
  });

  it("rejects resize on stopped PTY", () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ state: "stopped" });
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    expect(() => resize(record, 80, 24, registry, historyMap, bus)).toThrow("Cannot resize");
  });
});

describe("terminate", () => {
<<<<<<< HEAD
  const pidsToCleanup: number[] = [];

  afterEach(() => {
    for (const pid of pidsToCleanup) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
    pidsToCleanup.length = 0;
  });

  it("terminates with SIGTERM and cleans up", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    } as any) as any;
    pidsToCleanup.push(proc.pid as number);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid: proc.pid as number });
=======
  it("terminates with SIGTERM and cleans up", async () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ pid: 99998 });
>>>>>>> origin/main
    registry.register(record);
    const lifecycle = new PtyLifecycle(record.ptyId, "active");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

<<<<<<< HEAD
    await terminate(record, lifecycle, registry, historyMap, bus, {
      gracePeriodMs: 500,
    });
=======
    const mockIsAlive = () => false;
    const mockWait = async () => true;
    await terminate(
      record,
      lifecycle,
      registry,
      historyMap,
      bus,
      {
        gracePeriodMs: 50,
      },
      mockIsAlive,
      mockWait
    );
>>>>>>> origin/main

    expect(registry.get(record.ptyId)).toBeUndefined();

    const topics = bus.events.map(e => e.topic);
    expect(topics).toContain("pty.terminating");
<<<<<<< HEAD
    expect(topics).toContain("pty.signal.delivered");
=======
>>>>>>> origin/main
    expect(topics).toContain("pty.stopped");
  });

  it("is idempotent on stopped PTY", async () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ state: "stopped" });
    // Don't register — already cleaned up.
    const lifecycle = new PtyLifecycle(record.ptyId, "stopped");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    await terminate(record, lifecycle, registry, historyMap, bus);
    // No events emitted.
    expect(bus.events).toHaveLength(0);
  });

  it("escalates to SIGKILL after grace period", async () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ pid: 99999 });
    registry.register(record);
    const lifecycle = new PtyLifecycle(record.ptyId, "active");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    // Mock: process stays alive through grace, then dies after SIGKILL.
    let killCount = 0;
    const mockIsAlive = (_pid: number): boolean => {
      killCount++;
      // Alive during grace period checks (first 2 calls), dead after SIGKILL.
      return killCount <= 2;
    };
    const mockWaitForExit = async (_pid: number, _timeoutMs: number): Promise<boolean> => {
      // First call (grace period): not exited.
      // Second call (post-SIGKILL): exited.
      if (killCount <= 1) {
        killCount++;
        return false;
      }
      return true;
    };

    await terminate(
      record,
      lifecycle,
      registry,
      historyMap,
      bus,
      { gracePeriodMs: 50 },
      mockIsAlive,
      mockWaitForExit
    );

    const topics = bus.events.map(e => e.topic);
    expect(topics).toContain("pty.force_killed");
    expect(topics).toContain("pty.stopped");
  });

  it("handles terminate on throttled PTY", async () => {
<<<<<<< HEAD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    } as any) as any;
    pidsToCleanup.push(proc.pid as number);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid: proc.pid as number, state: "throttled" });
=======
    const registry = new PtyRegistry();
    const record = makeRecord({ pid: 99998, state: "throttled" });
>>>>>>> origin/main
    registry.register(record);
    const lifecycle = new PtyLifecycle(record.ptyId, "throttled");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

<<<<<<< HEAD
    await terminate(record, lifecycle, registry, historyMap, bus, {
      gracePeriodMs: 200,
    });
=======
    const mockIsAlive = () => false;
    const mockWait = async () => true;
    await terminate(
      record,
      lifecycle,
      registry,
      historyMap,
      bus,
      {
        gracePeriodMs: 50,
      },
      mockIsAlive,
      mockWait
    );
>>>>>>> origin/main

    expect(registry.get(record.ptyId)).toBeUndefined();
  });
});

describe("sendSighup", () => {
<<<<<<< HEAD
  const pidsToCleanup: number[] = [];

  afterEach(() => {
    for (const pid of pidsToCleanup) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
    pidsToCleanup.length = 0;
  });

  it("records signal delivery", () => {
    // Spawn a real child so SIGHUP has a valid target (not the test runner).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    } as any) as any;
    pidsToCleanup.push(proc.pid as number);

    const record = makeRecord({ pid: proc.pid as number });
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    const envelope = sendSighup(record, historyMap, bus);

    expect(envelope.outcome).toBe("delivered");
    expect(envelope.signal).toBe("SIGHUP");

    const history = historyMap.get(record.ptyId);
    expect(history?.length).toBe(1);

    expect(bus.events).toHaveLength(1);
    expect(bus.events[0]?.topic).toBe("pty.signal.delivered");
  });

  it("records failed delivery for dead process", () => {
=======
  it("records successful delivery", () => {
    // Spawn a real child so SIGHUP has a valid target (not the test runner).
    const pid = spawnShellProcess();
    pidsToCleanup.push(pid);

    const record = makeRecord({ pid });
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();
    const envelope = sendSighup(record, historyMap, bus);
    expect(envelope.outcome).toBe("delivered");
    expect(envelope.signal).toBe("SIGHUP");
    expect(historyMap.get(record.ptyId)?.length).toBe(1);
  });

  it("records failed delivery for dead process", () => {
    // Use a non-existent PID to avoid sending signals to the test process
>>>>>>> origin/main
    const record = makeRecord({ pid: 999999 });
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    const envelope = sendSighup(record, historyMap, bus);
<<<<<<< HEAD
    expect(envelope.outcome).toBe("failed");
    expect(envelope.error).toBeDefined();
=======

    expect(envelope.signal).toBe("SIGHUP");
    // Non-existent PID → delivery fails
    expect(envelope.outcome).toBe("failed");
    expect(envelope.error).toBeDefined();

    const history = historyMap.get(record.ptyId);
    expect(history?.length).toBe(1);
>>>>>>> origin/main
  });
});
