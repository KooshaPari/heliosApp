import { describe, it, expect, beforeEach } from "vitest";
import { makeAdapter } from "./acp-client_test_helpers.js";

describe("ACP Client Adapter: Task Cancellation and Termination", () => {
  const config = {
    endpoint: "http://localhost:8080/acp",
    apiKeyRef: "acp-key",
    model: "claude-3-sonnet",
    timeoutMs: 30000,
    maxRetries: 3,
    healthCheckIntervalMs: 30000,
  };

  let adapter = makeAdapter().adapter;
  let bus = makeAdapter().bus;

  beforeEach(async () => {
    const setup = makeAdapter();
    adapter = setup.adapter;
    bus = setup.bus;
    await adapter.init(config);
  });

  describe("Task Cancellation", () => {
    it("should cancel a task", async () => {
      const taskId = "task-123";
      await adapter.cancel(taskId);

      const events = bus.getEvents();
      const cancelledEvent = events.find((e) => e.topic === "provider.acp.execute.cancelled");
      expect(cancelledEvent).toBeDefined();
      expect(cancelledEvent?.payload?.taskId).toBe(taskId);
    });

    it("should emit cancellation event", async () => {
      bus.getEvents();
      await adapter.cancel("task-456");

      const events = bus.getEvents();
      const cancelledEvent = events.find((e) => e.topic === "provider.acp.execute.cancelled");
      expect(cancelledEvent).toBeDefined();
    });

    it("should be idempotent (cancel already-completed task)", async () => {
      await expect(adapter.cancel("non-existent")).resolves.toBeUndefined();
    });

    it("should reject cancel before init", async () => {
      const freshAdapter = makeAdapter().adapter;
      await expect(freshAdapter.cancel("task-123")).rejects.toThrow(/unavailable/i);
    });
  });

  describe("Termination", () => {
    it("should terminate successfully", async () => {
      let health = await adapter.health();
      expect(health.state).toBe("healthy");

      await adapter.terminate();

      health = await adapter.health();
      expect(health.state).toBe("unavailable");
      expect(health.message).toContain("Terminated");
    });

    it("should emit termination event", async () => {
      bus.getEvents();
      await adapter.terminate();

      const events = bus.getEvents();
      const terminatedEvent = events.find((e) => e.topic === "provider.acp.terminated");
      expect(terminatedEvent).toBeDefined();
    });

    it("should cancel in-flight tasks on terminate", async () => {
      const executePromise = adapter.execute({ prompt: "Long task" }, "corr-123");
      await adapter.terminate();
      await expect(executePromise).rejects.toThrow();
    });

    it("should prevent execution after termination", async () => {
      await adapter.terminate();

      await expect(adapter.execute({ prompt: "Test" }, "corr-123")).rejects.toThrow(
        /unavailable/i
      );
    });
  });
});
