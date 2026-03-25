import { describe, expect, test } from "bun:test";

import { RecoveryRegistry } from "../../../src/sessions/registry";

describe("RecoveryRegistry", () => {
  test("applies lifecycle updates and snapshots state", () => {
    const registry = new RecoveryRegistry();

    registry.apply("lane.create", {
      lane_id: "lane-1",
      workspace_id: "ws-1",
    });
    registry.apply("session.attach", {
      lane_id: "lane-1",
      session_id: "sess-1",
      workspace_id: "ws-1",
      codex_session_id: "codex-1",
    });
    registry.apply("terminal.spawn", {
      lane_id: "lane-1",
      session_id: "sess-1",
      terminal_id: "term-1",
      workspace_id: "ws-1",
    });

    const snapshot = registry.snapshot();
    expect(snapshot.lanes).toHaveLength(1);
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.terminals).toHaveLength(1);
    expect(registry.hasLane("lane-1")).toBe(true);
    expect(registry.hasSession("sess-1")).toBe(true);
    expect(registry.hasTerminal("term-1")).toBe(true);
  });

  test("reports orphaned recovery records", () => {
    const registry = new RecoveryRegistry();
    registry.apply("session.attach", {
      session_id: "sess-1",
      workspace_id: "ws-1",
      codex_session_id: "codex-1",
    });
    registry.apply("terminal.spawn", {
      terminal_id: "term-1",
      workspace_id: "ws-1",
      session_id: "sess-1",
    });

    const result = registry.scanForOrphans("2026-03-24T00:00:00.000Z");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.artifact_type === "session")).toBe(true);
  });
});
