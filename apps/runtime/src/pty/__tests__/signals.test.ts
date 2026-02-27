import { describe, expect, it, afterEach } from "bun:test";
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

function makeRecord(overrides?: Partial<PtyRecord>): PtyRecord {
  return {
    ptyId: "pty-test-1",
    laneId: "lane-1",
    sessionId: "session-1",
    terminalId: "term-1",
    pid: process.pid, // use own pid for safe signal tests
    state: "active",
    dimensions: { cols: 80, rows: 24 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    env: Object.freeze({}),
    ...overrides,
  };
}

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
    expect(history.getAll()[0]!.signal).toBe("SIGTERM");
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
    expect(history.getAll()[0]!.signal).toBe("SIGTERM");
  });
});

describe("resize", () => {
  it("updates dimensions and emits events", () => {
    const registry = new PtyRegistry();
    const record = makeRecord();
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    resize(record, 120, 40, registry, historyMap, bus);

    const updated = registry.get(record.ptyId);
    expect(updated?.dimensions).toEqual({ cols: 120, rows: 40 });

    const topics = bus.events.map((e) => e.topic);
    expect(topics).toContain("pty.signal.delivered");
    expect(topics).toContain("pty.resized");

    // Check resize event payload includes old/new dimensions.
    const resizeEvt = bus.events.find((e) => e.topic === "pty.resized");
    expect(resizeEvt?.payload["oldDimensions"]).toEqual({
      cols: 80,
      rows: 24,
    });
    expect(resizeEvt?.payload["newDimensions"]).toEqual({
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

    expect(() => resize(record, 0, 24, registry, historyMap, bus)).toThrow(
      InvalidDimensionsError,
    );
    expect(() => resize(record, 80, 0, registry, historyMap, bus)).toThrow(
      InvalidDimensionsError,
    );
    expect(() => resize(record, 10001, 24, registry, historyMap, bus)).toThrow(
      InvalidDimensionsError,
    );
  });

  it("rejects resize on errored PTY", () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ state: "errored" });
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    expect(() => resize(record, 80, 24, registry, historyMap, bus)).toThrow(
      "Cannot resize",
    );
  });

  it("rejects resize on stopped PTY", () => {
    const registry = new PtyRegistry();
    const record = makeRecord({ state: "stopped" });
    registry.register(record);
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    expect(() => resize(record, 80, 24, registry, historyMap, bus)).toThrow(
      "Cannot resize",
    );
  });
});

describe("terminate", () => {
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
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    pidsToCleanup.push(proc.pid);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid: proc.pid });
    registry.register(record);
    const lifecycle = new PtyLifecycle(record.ptyId, "active");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    await terminate(record, lifecycle, registry, historyMap, bus, {
      gracePeriodMs: 500,
    });

    expect(registry.get(record.ptyId)).toBeUndefined();

    const topics = bus.events.map((e) => e.topic);
    expect(topics).toContain("pty.terminating");
    expect(topics).toContain("pty.signal.delivered");
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
    const mockWaitForExit = async (
      _pid: number,
      _timeoutMs: number,
    ): Promise<boolean> => {
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
      mockWaitForExit,
    );

    const topics = bus.events.map((e) => e.topic);
    expect(topics).toContain("pty.force_killed");
    expect(topics).toContain("pty.stopped");
  });

  it("handles terminate on throttled PTY", async () => {
    const proc = Bun.spawn(["/bin/sh"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    pidsToCleanup.push(proc.pid);

    const registry = new PtyRegistry();
    const record = makeRecord({ pid: proc.pid, state: "throttled" });
    registry.register(record);
    const lifecycle = new PtyLifecycle(record.ptyId, "throttled");
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    await terminate(record, lifecycle, registry, historyMap, bus, {
      gracePeriodMs: 200,
    });

    expect(registry.get(record.ptyId)).toBeUndefined();
  });
});

describe("sendSighup", () => {
  it("records signal delivery", () => {
    const record = makeRecord();
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    const envelope = sendSighup(record, historyMap, bus);

    // Signal to self (process.pid) should succeed.
    expect(envelope.outcome).toBe("delivered");
    expect(envelope.signal).toBe("SIGHUP");

    const history = historyMap.get(record.ptyId);
    expect(history?.length).toBe(1);

    expect(bus.events).toHaveLength(1);
    expect(bus.events[0]!.topic).toBe("pty.signal.delivered");
  });

  it("records failed delivery for dead process", () => {
    const record = makeRecord({ pid: 999999 });
    const historyMap: SignalHistoryMap = new Map();
    const bus = new InMemoryBusPublisher();

    const envelope = sendSighup(record, historyMap, bus);
    expect(envelope.outcome).toBe("failed");
    expect(envelope.error).toBeDefined();
  });
});
