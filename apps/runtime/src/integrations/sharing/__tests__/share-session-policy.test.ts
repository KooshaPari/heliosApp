/**
 * Share session policy gate tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createShareManager } from "./share-session_test_helpers.js";

describe("Policy Gate Integration", () => {
  let manager = createShareManager().manager;
  let bus = createShareManager().bus;
  let policyGate = createShareManager().policyGate;

  beforeEach(() => {
    ({ manager, bus, policyGate } = createShareManager());
  });

  it("should deny share creation when policy gate denies", async () => {
    policyGate.setShouldDeny(true, "Access denied");

    await expect(manager.create("terminal-123", "upterm", 60000, "corr-001")).rejects.toThrow(
      /policy denied|access denied/i
    );
  });

  it("should emit failure event when policy denies", async () => {
    policyGate.setShouldDeny(true, "Access denied");
    bus.getEvents();

    try {
      await manager.create("terminal-123", "upterm", 60000, "corr-001");
    } catch {
      // expected
    }

    const failedEvent = bus.getEvents().find(e => e.topic === "share.session.failed");
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.payload?.reason).toContain("Access denied");
  });

  it("should not spawn worker when policy denies", async () => {
    policyGate.setShouldDeny(true, "Access denied");

    try {
      await manager.create("terminal-123", "upterm", 60000, "corr-001");
    } catch {
      // expected
    }
  });

  it("should allow share creation when policy approves", async () => {
    policyGate.setShouldDeny(false);

    const session = await manager.create("terminal-123", "upterm", 60000, "corr-001");

    expect(session.state).toBe("active");
    expect(session.shareLink).toBeTruthy();
  });
});
