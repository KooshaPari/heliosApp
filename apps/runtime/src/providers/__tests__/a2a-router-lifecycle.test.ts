/**
 * A2A Router lifecycle, health monitoring, termination, and error handling tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { A2ARouterAdapter } from "../a2a-router.js";
import { InMemoryLocalBus } from "../../protocol/bus.js";

type RouterConfig = {
  endpoints: Array<{ id: string; url: string; priority: number; capabilities: string[] }>;
  timeoutMs: number;
  failoverEnabled: boolean;
};

describe("A2A Router Adapter: Lifecycle", () => {
  let adapter: A2ARouterAdapter;
  let bus: InMemoryLocalBus;

  beforeEach(() => {
    bus = new InMemoryLocalBus();
    adapter = new A2ARouterAdapter(bus);
  });

  describe("Health Monitoring", () => {
    beforeEach(async () => {
      const config: RouterConfig = {
        endpoints: [
          {
            id: "agent-1",
            url: "http://localhost:9000",
            priority: 1,
            capabilities: [],
          },
        ],
        timeoutMs: 30000,
        failoverEnabled: true,
      };
      await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    });

    it("should report healthy initially", async () => {
      const health = await adapter.health();
      expect(health.state).toBe("healthy");
      expect(health.failureCount).toBe(0);
    });

    it("should include timestamp in health status", async () => {
      const health = await adapter.health();
      expect(health.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe("Termination", () => {
    beforeEach(async () => {
      const config: RouterConfig = {
        endpoints: [
          {
            id: "agent-1",
            url: "http://localhost:9000",
            priority: 1,
            capabilities: [],
          },
        ],
        timeoutMs: 30000,
        failoverEnabled: true,
      };
      await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    });

    it("should terminate successfully", async () => {
      let health = await adapter.health();
      expect(health.state).toBe("healthy");

      await adapter.terminate();

      health = await adapter.health();
      expect(health.state).toBe("unavailable");
    });

    it("should emit termination event", async () => {
      bus.getEvents();

      await adapter.terminate();

      const events = bus.getEvents();
      const terminatedEvent = events.find((e) => e.topic === "provider.a2a.terminated");
      expect(terminatedEvent).toBeDefined();
    });

    it("should prevent delegation after termination", async () => {
      await adapter.terminate();

      await expect(
        adapter.execute(
          {
            taskDescription: "Test",
            requiredCapabilities: [],
            context: {},
          },
          "corr-123"
        )
      ).rejects.toThrow(/unavailable/i);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      const config: RouterConfig = {
        endpoints: [
          {
            id: "agent-1",
            url: "http://localhost:9000",
            priority: 1,
            capabilities: ["inference"],
          },
        ],
        timeoutMs: 30000,
        failoverEnabled: true,
      };
      await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    });

    it("should emit error event on delegation failure", async () => {
      bus.getEvents();

      try {
        await adapter.execute(
          {
            taskDescription: "Test",
            requiredCapabilities: ["unknown"],
            context: {},
          },
          "corr-123"
        );
      } catch {
        // Expected
      }

      const events = bus.getEvents();
      const errorEvent = events.find(
        (e) => e.topic === "provider.a2a.delegation.failed"
      );
      expect(errorEvent).toBeDefined();
    });
  });
});
