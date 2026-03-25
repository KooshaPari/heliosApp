/**
 * Share session termination tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createShareManager } from "./share-session_test_helpers.js";

describe("Share Session Termination", () => {
  let manager = createShareManager().manager;
  let bus = createShareManager().bus;

  beforeEach(() => {
    ({ manager, bus } = createShareManager());
  });

  it("should terminate a share session", async () => {
    const session = await manager.create("terminal-123", "upterm", 60000, "corr-001");

    await manager.terminate(session.id);

    expect(manager.get(session.id)).toBeUndefined();
  });

  it("should emit termination event", async () => {
    const session = await manager.create("terminal-123", "upterm", 60000, "corr-001");
    bus.getEvents();

    await manager.terminate(session.id);

    const terminatedEvent = bus
      .getEvents()
      .find((e) => e.topic === "share.session.terminated");
    expect(terminatedEvent).toBeDefined();
  });

  it("should throw when terminating non-existent session", async () => {
    await expect(manager.terminate("non-existent")).rejects.toThrow(/not found/i);
  });

  it("should cleanup worker on termination", async () => {
    const session = await manager.create("terminal-123", "upterm", 60000, "corr-001");
    const pidBefore = session.workerPid;

    expect(pidBefore).toBeGreaterThan(0);

    await manager.terminate(session.id);
  });
});
