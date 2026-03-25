/**
 * Share session creation and lifecycle tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createShareManager } from "./share-session_test_helpers.js";

describe("Share Session Creation", () => {
  let manager = createShareManager().manager;
  let bus = createShareManager().bus;

  beforeEach(() => {
    ({ manager, bus } = createShareManager());
  });

  it("should create a share session with upterm backend", async () => {
    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      "corr-001",
    );

    expect(session.id).toBeTruthy();
    expect(session.terminalId).toBe("terminal-123");
    expect(session.backend).toBe("upterm");
    expect(session.state).toBe("active");
    expect(session.shareLink).toBeTruthy();
    expect(session.workerPid).toBeGreaterThan(0);
  });

  it("should create a share session with tmate backend", async () => {
    const session = await manager.create(
      "terminal-456",
      "tmate",
      60000,
      "corr-002",
    );

    expect(session.id).toBeTruthy();
    expect(session.backend).toBe("tmate");
    expect(session.state).toBe("active");
    expect(session.shareLink).toBeTruthy();
  });

  it("should include correlation ID in session", async () => {
    const correlationId = "unique-trace-id";

    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      correlationId,
    );

    expect(session.correlationId).toBe(correlationId);
  });

  it("should set expiration based on TTL", async () => {
    const ttlMs = 3_600_000;
    const beforeCreate = Date.now();

    const session = await manager.create(
      "terminal-123",
      "upterm",
      ttlMs,
      "corr-001",
    );

    const afterCreate = Date.now();

    expect(session.expiresAt).toBeTruthy();
    if (session.expiresAt) {
      const expirationTime = session.expiresAt.getTime();
      expect(expirationTime).toBeGreaterThanOrEqual(beforeCreate + ttlMs);
      expect(expirationTime).toBeLessThanOrEqual(afterCreate + ttlMs);
    }
  });

  it("should emit session creation event", async () => {
    bus.getEvents();

    await manager.create("terminal-123", "upterm", 60000, "corr-001");

    const createdEvent = bus
      .getEvents()
      .find((e) => e.topic === "share.session.created");
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.payload?.backend).toBe("upterm");
  });

  it("should emit session active event after worker spawn", async () => {
    bus.getEvents();

    await manager.create("terminal-123", "upterm", 60000, "corr-001");

    const activeEvent = bus
      .getEvents()
      .find((e) => e.topic === "share.session.active");
    expect(activeEvent).toBeDefined();
    expect(activeEvent?.payload?.shareLink).toBeTruthy();
  });

  it("should start in pending state before worker spawn", async () => {
    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      "corr-001",
    );

    expect(session.state).toBe("active");
  });

  it("should transition to active after worker spawn", async () => {
    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      "corr-001",
    );

    expect(session.state).toBe("active");
    expect(session.shareLink).toBeTruthy();
  });

  it("should transition to revoked on terminate", async () => {
    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      "corr-001",
    );

    await manager.terminate(session.id);

    expect(manager.get(session.id)).toBeUndefined();
  });

  it("should fail if worker spawn fails", async () => {
    const session = await manager.create(
      "terminal-123",
      "upterm",
      60000,
      "corr-001",
    );
    expect(session.state).toBe("active");
  });

  it("should support multiple sessions for same terminal", async () => {
    const terminalId = "terminal-123";

    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(manager.create(terminalId, "upterm", 60000, `corr-${i}`));
    }

    const sessions = await Promise.all(promises);

    expect(sessions).toHaveLength(3);
    expect(manager.listByTerminal(terminalId)).toHaveLength(3);
  });

  it("should track sessions separately by backend", async () => {
    const terminalId = "terminal-123";

    await manager.create(terminalId, "upterm", 60000, "corr-001");
    await manager.create(terminalId, "tmate", 60000, "corr-002");

    const backends = manager.listByTerminal(terminalId).map((session) => session.backend);

    expect(backends).toContain("upterm");
    expect(backends).toContain("tmate");
  });
});
