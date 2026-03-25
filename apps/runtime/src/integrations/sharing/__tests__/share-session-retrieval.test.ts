/**
 * Share session retrieval tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createShareManager } from "./share-session_test_helpers.js";

describe("Share Session Retrieval", () => {
  let manager = createShareManager().manager;

  beforeEach(() => {
    ({ manager } = createShareManager());
  });

  it("should get session by ID", async () => {
    const created = await manager.create("terminal-123", "upterm", 60000, "corr-001");

    const retrieved = manager.get(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  it("should return undefined for non-existent session", async () => {
    expect(manager.get("non-existent")).toBeUndefined();
  });

  it("should list sessions by terminal", async () => {
    const terminalId = "terminal-123";

    const session1 = await manager.create(terminalId, "upterm", 60000, "corr-001");
    const session2 = await manager.create(terminalId, "tmate", 60000, "corr-002");

    const sessions = manager.listByTerminal(terminalId);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id)).toContain(session1.id);
    expect(sessions.map((s) => s.id)).toContain(session2.id);
  });

  it("should return empty list for terminal with no sessions", async () => {
    expect(manager.listByTerminal("non-existent-terminal")).toHaveLength(0);
  });

  it("should separate sessions by terminal", async () => {
    await manager.create("terminal-1", "upterm", 60000, "corr-001");
    await manager.create("terminal-2", "upterm", 60000, "corr-002");

    const sessions1 = manager.listByTerminal("terminal-1");
    const sessions2 = manager.listByTerminal("terminal-2");

    expect(sessions1).toHaveLength(1);
    expect(sessions2).toHaveLength(1);
    expect(sessions1[0].terminalId).toBe("terminal-1");
    expect(sessions2[0].terminalId).toBe("terminal-2");
  });
});
