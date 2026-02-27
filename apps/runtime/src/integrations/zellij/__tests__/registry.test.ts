import { describe, expect, it, mock, beforeEach } from "bun:test";
import { MuxRegistry } from "../registry.js";
import { DuplicateBindingError } from "../errors.js";
import { ZellijCli } from "../cli.js";
import type { MuxSession } from "../types.js";

// Helper to create a mock spawn result
function makeMockProc(stdout: string, stderr: string, exitCode: number) {
  const stdoutStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(stdout));
      controller.close();
    },
  });
  const stderrStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(stderr));
      controller.close();
    },
  });

  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited: Promise.resolve(exitCode),
    kill: mock(() => {}),
  };
}

function makeMockSession(
  sessionName: string,
  laneId: string
): MuxSession {
  return {
    sessionName,
    laneId,
    createdAt: new Date(),
    panes: [],
    tabs: [],
  };
}

describe("MuxRegistry", () => {
  it("binds and retrieves by session name", () => {
    const registry = new MuxRegistry();
    const session = makeMockSession("helios-lane-abc", "abc");

    registry.bind("helios-lane-abc", "abc", session);

    const binding = registry.getBySession("helios-lane-abc");
    expect(binding).toBeDefined();
    expect(binding?.laneId).toBe("abc");
    expect(binding?.sessionName).toBe("helios-lane-abc");
  });

  it("retrieves by lane ID", () => {
    const registry = new MuxRegistry();
    const session = makeMockSession("helios-lane-xyz", "xyz");

    registry.bind("helios-lane-xyz", "xyz", session);

    const binding = registry.getByLane("xyz");
    expect(binding).toBeDefined();
    expect(binding?.sessionName).toBe("helios-lane-xyz");
  });

  it("enforces one-to-one: duplicate session throws", () => {
    const registry = new MuxRegistry();
    const session1 = makeMockSession("helios-lane-a", "a");
    const session2 = makeMockSession("helios-lane-a", "b");

    registry.bind("helios-lane-a", "a", session1);

    expect(() =>
      registry.bind("helios-lane-a", "b", session2)
    ).toThrow(DuplicateBindingError);
  });

  it("enforces one-to-one: duplicate lane throws", () => {
    const registry = new MuxRegistry();
    const session1 = makeMockSession("session-1", "lane-1");
    const session2 = makeMockSession("session-2", "lane-1");

    registry.bind("session-1", "lane-1", session1);

    expect(() =>
      registry.bind("session-2", "lane-1", session2)
    ).toThrow(DuplicateBindingError);
  });

  it("unbind removes the binding", () => {
    const registry = new MuxRegistry();
    const session = makeMockSession("helios-lane-del", "del");

    registry.bind("helios-lane-del", "del", session);
    registry.unbind("helios-lane-del");

    expect(registry.getBySession("helios-lane-del")).toBeUndefined();
    expect(registry.getByLane("del")).toBeUndefined();
  });

  it("unbind non-existent is a no-op", () => {
    const registry = new MuxRegistry();
    // Should not throw
    registry.unbind("does-not-exist");
  });

  it("list returns all bindings", () => {
    const registry = new MuxRegistry();
    registry.bind("s1", "l1", makeMockSession("s1", "l1"));
    registry.bind("s2", "l2", makeMockSession("s2", "l2"));

    const all = registry.list();
    expect(all).toHaveLength(2);
  });

  it("allows rebinding after unbind", () => {
    const registry = new MuxRegistry();
    const session1 = makeMockSession("s1", "l1");
    const session2 = makeMockSession("s1", "l1");

    registry.bind("s1", "l1", session1);
    registry.unbind("s1");
    // Should not throw now
    registry.bind("s1", "l1", session2);

    expect(registry.getBySession("s1")).toBeDefined();
  });

  describe("getOrphaned", () => {
    let originalSpawn: typeof Bun.spawn;

    beforeEach(() => {
      originalSpawn = Bun.spawn;
    });

    it("returns empty array when no CLI is provided", async () => {
      const registry = new MuxRegistry();
      registry.bind("s1", "l1", makeMockSession("s1", "l1"));

      const orphaned = await registry.getOrphaned();

      expect(orphaned).toHaveLength(0);

      Bun.spawn = originalSpawn;
    });

    it("returns bindings for sessions that no longer exist", async () => {
      // Mock CLI to return only one live session
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("live-session  2026-02-27 10:00:00", "", 0)
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry(cli);

      // Bind multiple sessions
      registry.bind("live-session", "l1", makeMockSession("live-session", "l1"));
      registry.bind("dead-session", "l2", makeMockSession("dead-session", "l2"));
      registry.bind(
        "another-dead",
        "l3",
        makeMockSession("another-dead", "l3")
      );

      const orphaned = await registry.getOrphaned();

      expect(orphaned).toHaveLength(2);
      const orphanedNames = orphaned.map((b) => b.sessionName);
      expect(orphanedNames).toContain("dead-session");
      expect(orphanedNames).toContain("another-dead");
      expect(orphanedNames).not.toContain("live-session");

      Bun.spawn = originalSpawn;
    });

    it("returns empty array when all bindings are live", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc(
          "session1  2026-02-27 10:00:00\nsession2  2026-02-27 10:00:00",
          "",
          0
        )
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry(cli);

      registry.bind("session1", "l1", makeMockSession("session1", "l1"));
      registry.bind("session2", "l2", makeMockSession("session2", "l2"));

      const orphaned = await registry.getOrphaned();

      expect(orphaned).toHaveLength(0);

      Bun.spawn = originalSpawn;
    });

    it("returns all bindings when no live sessions exist", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("", "", 0));

      const cli = new ZellijCli();
      const registry = new MuxRegistry(cli);

      registry.bind("s1", "l1", makeMockSession("s1", "l1"));
      registry.bind("s2", "l2", makeMockSession("s2", "l2"));

      const orphaned = await registry.getOrphaned();

      expect(orphaned).toHaveLength(2);

      Bun.spawn = originalSpawn;
    });

    it("handles errors from CLI gracefully", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        throw new Error("CLI error");
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry(cli);

      registry.bind("s1", "l1", makeMockSession("s1", "l1"));

      // Should not throw, might return empty or fail gracefully
      await expect(registry.getOrphaned()).rejects.toThrow();

      Bun.spawn = originalSpawn;
    });
  });
});