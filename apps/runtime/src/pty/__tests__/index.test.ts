import { describe, expect, it, afterEach } from "bun:test";
import { PtyManager, NotImplementedError } from "../index.js";

describe("PtyManager", () => {
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

  it("spawn and get", async () => {
    const mgr = new PtyManager();
    const record = await mgr.spawn({
      shell: "/bin/sh",
      laneId: "lane-1",
      sessionId: "session-1",
      terminalId: "term-1",
    });

    pidsToCleanup.push(record.pid);

    expect(record.state).toBe("active");
    expect(mgr.get(record.ptyId)).toBe(record);
  });

  it("getByLane works", async () => {
    const mgr = new PtyManager();
    const r1 = await mgr.spawn({
      shell: "/bin/sh",
      laneId: "lane-A",
      sessionId: "s1",
      terminalId: "t1",
    });
    const r2 = await mgr.spawn({
      shell: "/bin/sh",
      laneId: "lane-A",
      sessionId: "s2",
      terminalId: "t2",
    });

    pidsToCleanup.push(r1.pid, r2.pid);

    expect(mgr.getByLane("lane-A")).toHaveLength(2);
    expect(mgr.getByLane("lane-B")).toHaveLength(0);
  });

  it("terminate throws NotImplementedError", async () => {
    const mgr = new PtyManager();
    await expect(mgr.terminate("pty-1")).rejects.toThrow(NotImplementedError);
  });

  it("resize throws NotImplementedError", () => {
    const mgr = new PtyManager();
    expect(() => mgr.resize("pty-1", 80, 24)).toThrow(NotImplementedError);
  });

  it("writeInput throws NotImplementedError", () => {
    const mgr = new PtyManager();
    expect(() => mgr.writeInput("pty-1", new Uint8Array())).toThrow(
      NotImplementedError,
    );
  });

  it("reconcileOrphans completes without error", async () => {
    const mgr = new PtyManager();
    const summary = await mgr.reconcileOrphans();
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.found).toBeGreaterThanOrEqual(0);
  });
});
