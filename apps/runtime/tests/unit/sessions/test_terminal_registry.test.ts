import { describe, expect, test } from "bun:test";

import { TerminalRegistry } from "../../../src/sessions/terminal_registry";

type SpawnInput = Parameters<TerminalRegistry["spawn"]>[0];
type ExpectedContext = Parameters<TerminalRegistry["isOwnedBy"]>[1];

const CONTEXT_KEYS = {
  terminalId: "terminal_id",
  workspaceId: "workspace_id",
  laneId: "lane_id",
  sessionId: "session_id",
} as const;

const buildSpawnInput = (
  terminalId: string,
  workspaceId: string,
  laneId: string,
  sessionId: string,
  title = "Terminal"
): SpawnInput => {
  return {
    [CONTEXT_KEYS.terminalId]: terminalId,
    [CONTEXT_KEYS.workspaceId]: workspaceId,
    [CONTEXT_KEYS.laneId]: laneId,
    [CONTEXT_KEYS.sessionId]: sessionId,
    title,
  };
};

describe("TerminalRegistry", () => {
  test("stores and queries terminal context", () => {
    const registry = new TerminalRegistry();
    const terminal = registry.spawn(buildSpawnInput("t-1", "ws-1", "lane-1", "sess-1", "Alpha"));

    expect(terminal.state).toBe("spawning");
    expect(registry.get("t-1")?.session_id).toBe("sess-1");
    expect(registry.listBySession("sess-1")).toHaveLength(1);
  });

  test("enforces ownership boundaries for workspace lane session", () => {
    const registry = new TerminalRegistry();
    registry.spawn(buildSpawnInput("t-2", "ws-1", "lane-1", "sess-1"));

    const matchingContext: ExpectedContext = {
      [CONTEXT_KEYS.workspaceId]: "ws-1",
      [CONTEXT_KEYS.laneId]: "lane-1",
      [CONTEXT_KEYS.sessionId]: "sess-1",
    };
    const mismatchedContext: ExpectedContext = {
      [CONTEXT_KEYS.workspaceId]: "ws-1",
      [CONTEXT_KEYS.laneId]: "lane-2",
      [CONTEXT_KEYS.sessionId]: "sess-1",
    };

    expect(registry.isOwnedBy("t-2", matchingContext)).toBe(true);
    expect(registry.isOwnedBy("t-2", mismatchedContext)).toBe(false);
  });

  test("cleans up session scoped terminals", () => {
    const registry = new TerminalRegistry();
    registry.spawn(buildSpawnInput("t-3", "ws-1", "lane-1", "sess-1"));
    registry.spawn(buildSpawnInput("t-4", "ws-1", "lane-1", "sess-1"));

    registry.removeBySession("sess-1");

    expect(registry.get("t-3")).toBeUndefined();
    expect(registry.get("t-4")).toBeUndefined();
    expect(registry.listBySession("sess-1")).toHaveLength(0);
  });

  test("re-indexes terminal ownership when terminal_id is reused", () => {
    const registry = new TerminalRegistry();
    registry.spawn(buildSpawnInput("t-5", "ws-1", "lane-1", "sess-1"));
    registry.spawn(buildSpawnInput("t-5", "ws-1", "lane-2", "sess-2"));

    expect(registry.listBySession("sess-1")).toHaveLength(0);
    expect(registry.listBySession("sess-2")).toHaveLength(1);
    expect(registry.listBySession("sess-2")[0]?.lane_id).toBe("lane-2");
  });
});
