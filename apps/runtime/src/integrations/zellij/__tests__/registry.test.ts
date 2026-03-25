import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { DuplicateBindingError } from "../errors.js";
import { MuxRegistry } from "../registry.js";
import type { MuxSession } from "../types.js";

function makeMockSession(sessionName: string, laneId: string): MuxSession {
  return {
    sessionName,
    laneId,
    createdAt: new Date(),
    panes: [],
    tabs: [],
  };
}

function makeMockCli(liveSessions: Array<{ name: string }>) {
  return {
    listSessions: mock(async () => liveSessions),
  };
}

describe("MuxRegistry", () => {
  let warnSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    warnSpy = mock(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore?.();
  });

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

    expect(() => registry.bind("helios-lane-a", "b", session2)).toThrow(DuplicateBindingError);
  });

  it("enforces one-to-one: duplicate lane throws", () => {
    const registry = new MuxRegistry();
    const session1 = makeMockSession("session-1", "lane-1");
    const session2 = makeMockSession("session-2", "lane-1");

    registry.bind("session-1", "lane-1", session1);

    expect(() => registry.bind("session-2", "lane-1", session2)).toThrow(DuplicateBindingError);
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

  it("returns orphaned bindings when live sessions no longer include them", async () => {
    const cli = makeMockCli([{ name: "live-session" }]);
    const registry = new MuxRegistry(cli as never);

    registry.bind("live-session", "lane-live", makeMockSession("live-session", "lane-live"));
    registry.bind("stale-session", "lane-stale", makeMockSession("stale-session", "lane-stale"));

    const orphaned = await registry.getOrphaned();

    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]?.sessionName).toBe("stale-session");
    expect(cli.listSessions).toHaveBeenCalledTimes(1);
  });

  it("returns empty orphaned list without a cli", async () => {
    const registry = new MuxRegistry();

    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      await expect(registry.getOrphaned()).resolves.toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = originalWarn;
    }
  });
});
