import { describe, it, expect, beforeEach, afterEach, jest as vi } from "bun:test";
import { Watchdog, CrashReason, type CrashEvent } from "../watchdog.js";
import { InMemoryLocalBus, type LocalBus } from "../../protocol/bus.js";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

describe("Watchdog", () => {
  let watchdog: Watchdog;
  let tempDir: string;
  let bus: LocalBus;

  const flushAsyncWork = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    tempDir = path.join(os.tmpdir(), `watchdog-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    bus = new InMemoryLocalBus() as LocalBus;
    watchdog = new Watchdog(tempDir, bus);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Cleanup temp dir
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should detect heartbeat timeout when no heartbeat received", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    vi.advanceTimersByTime(4100); // 2 * 2000 + 100ms
    await flushAsyncWork();

    expect(crashEvents.length).toBe(1);
    expect(crashEvents.at(0)?.reason).toBe(CrashReason.HEARTBEAT_TIMEOUT);
    expect(crashEvents.at(0)?.name).toBe("test-proc");
    expect(crashEvents.at(0)?.pid).toBe(1234);
  });

  it("should reset timeout on heartbeat", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    vi.advanceTimersByTime(3000);
    await flushAsyncWork();
    watchdog.receiveHeartbeat("test-proc");
    vi.advanceTimersByTime(3000);
    await flushAsyncWork();

    expect(crashEvents.length).toBe(0);
  });

  it("should unregister clears timers", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    watchdog.unregister("test-proc");
    vi.advanceTimersByTime(4100);
    await flushAsyncWork();

    expect(crashEvents.length).toBe(0);
  });

  it("should invoke crash handler with correct reason", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 1000);
    vi.advanceTimersByTime(2100);
    await flushAsyncWork();

    expect(crashEvents.length).toBe(1);
    expect(crashEvents.at(0)?.reason).toBeDefined();
  });

  it("should publish crash event to bus", async () => {
    watchdog.registerProcess("test-proc", 1234, 1000);
    vi.advanceTimersByTime(2100);
    await flushAsyncWork();

    const event = bus.getEvents().at(0);
    expect(event).toBeDefined();
    expect(event).not.toBeUndefined();
    expect(event?.topic).toBe("recovery.crash.detected");
    expect((event?.payload as { name?: string }).name).toBe("test-proc");
  });

  it("should write crash record to filesystem", async () => {
    watchdog.registerProcess("test-proc", 1234, 1000);
    vi.advanceTimersByTime(2100);
    vi.runAllTimers();
    await flushAsyncWork();

    const recordPath = path.join(tempDir, "recovery", "last-crash.json");
    const exists = await fs.access(recordPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("should handle process exit with exit code", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    await watchdog.handleProcessExit("test-proc", 1234, 1);
    await flushAsyncWork();

    expect(crashEvents.length).toBe(1);
    expect(crashEvents.at(0)?.reason).toBe(CrashReason.EXIT_CODE);
    expect(crashEvents.at(0)?.exitCode).toBe(1);
  });

  it("should not trigger crash on graceful exit code 0", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    await watchdog.handleProcessExit("test-proc", 1234, 0);

    expect(crashEvents.length).toBe(0);
  });

  it("should not trigger crash on SIGTERM", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    await watchdog.handleProcessExit("test-proc", 1234, undefined, "SIGTERM");
    await flushAsyncWork();

    expect(crashEvents.length).toBe(0);
  });

  it("should trigger crash on SIGKILL", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("test-proc", 1234, 2000);
    await watchdog.handleProcessExit("test-proc", 1234, undefined, "SIGKILL");
    await flushAsyncWork();

    expect(crashEvents.length).toBe(1);
    expect(crashEvents.at(0)?.reason).toBe(CrashReason.SIGNAL);
  });

  it("should handle multiple process monitoring", async () => {
    const crashEvents: CrashEvent[] = [];
    watchdog.onCrashDetected((event) => crashEvents.push(event));

    watchdog.registerProcess("proc1", 1001, 2000);
    watchdog.registerProcess("proc2", 1002, 2000);

    vi.advanceTimersByTime(4100);
    await flushAsyncWork();

    expect(crashEvents.length).toBe(2);
    expect(crashEvents.map((e) => e.name)).toContain("proc1");
    expect(crashEvents.map((e) => e.name)).toContain("proc2");
  });
});
