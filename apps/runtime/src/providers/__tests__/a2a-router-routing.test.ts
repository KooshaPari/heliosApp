/**
 * A2A Router delegation and failover routing tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryLocalBus } from "../../protocol/bus.js";
import { A2ARouterAdapter } from "../a2a-router.js";

type RouterConfig = {
  endpoints: Array<{ id: string; url: string; priority: number; capabilities: string[] }>;
  timeoutMs: number;
  failoverEnabled: boolean;
};

describe("A2A Router Adapter: Routing", () => {
  let adapter: A2ARouterAdapter;
  let bus: InMemoryLocalBus;

  beforeEach(() => {
    bus = new InMemoryLocalBus();
    adapter = new A2ARouterAdapter(bus);
  });

  describe("Delegation Routing", () => {
    beforeEach(async () => {
      const config: RouterConfig = {
        endpoints: [
          {
            id: "agent-1",
            url: "http://localhost:9000",
            priority: 1,
            capabilities: ["inference", "planning"],
          },
          {
            id: "agent-2",
            url: "http://localhost:9001",
            priority: 2,
            capabilities: ["inference"],
          },
        ],
        timeoutMs: 30000,
        failoverEnabled: true,
      };
      await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    });

    it("should delegate to endpoint with matching capabilities", async () => {
      const result = await adapter.execute(
        {
          taskDescription: "Plan a task",
          requiredCapabilities: ["planning"],
          context: { deadline: "2026-03-02" },
        },
        "corr-123"
      );

      expect(result).toBeDefined();
      expect(result.correlationId).toBe("corr-123");
      expect(result.endpointId).toBe("agent-1");
    });

    it("should select first matching endpoint by priority", async () => {
      const result = await adapter.execute(
        {
          taskDescription: "Run inference",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      expect(result.endpointId).toBe("agent-1");
    });

    it("should reject delegation without matching endpoints", async () => {
      await expect(
        adapter.execute(
          {
            taskDescription: "Unknown capability",
            requiredCapabilities: ["unknown-capability"],
            context: {},
          },
          "corr-123"
        )
      ).rejects.toThrow();
    });

    it("should propagate correlation ID in result", async () => {
      const correlationId = "unique-trace-id";

      const result = await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        correlationId
      );

      expect(result.correlationId).toBe(correlationId);
    });

    it("should emit delegation completed event", async () => {
      bus.getEvents();

      await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      const events = bus.getEvents();
      const completedEvent = events.find(e => e.topic === "provider.a2a.delegation.completed");
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.payload?.correlationId).toBe("corr-123");
    });

    it("should include duration in result", async () => {
      const result = await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Failover Routing", () => {
    beforeEach(async () => {
      const config: RouterConfig = {
        endpoints: [
          {
            id: "agent-1",
            url: "http://localhost:9000",
            priority: 1,
            capabilities: ["inference"],
          },
          {
            id: "agent-2",
            url: "http://localhost:9001",
            priority: 2,
            capabilities: ["inference"],
          },
        ],
        timeoutMs: 30000,
        failoverEnabled: true,
      };
      await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    });

    it("should route to healthy endpoint", async () => {
      const result = await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      expect(result).toBeDefined();
    });

    it("should route to degraded endpoint if no healthy one available", async () => {
      adapter.updateEndpointHealth("agent-1", {
        state: "degraded",
        lastCheck: new Date(),
        failureCount: 3,
      });

      const result = await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      expect(result.endpointId).toBe("agent-2");
    });

    it("should failover between endpoints", async () => {
      adapter.updateEndpointHealth("agent-1", {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 5,
      });

      const result = await adapter.execute(
        {
          taskDescription: "Test",
          requiredCapabilities: ["inference"],
          context: {},
        },
        "corr-123"
      );

      expect(result.endpointId).toBe("agent-2");
    });
  });
});
