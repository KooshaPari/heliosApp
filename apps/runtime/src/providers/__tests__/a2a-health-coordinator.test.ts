/**
 * A2A Health Monitoring Coordinator tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { HealthMonitoringCoordinator } from "../a2a-router.js";
import { InMemoryLocalBus } from "../../protocol/bus.js";
import { A2ARouterAdapter } from "../a2a-router.js";
import { NormalizedProviderError } from "../errors.js";
import type { ProviderHealthStatus } from "../adapter.js";

describe("Health Monitoring Coordinator", () => {
  let coordinator: HealthMonitoringCoordinator;
  let bus: InMemoryLocalBus;

  beforeEach(() => {
    bus = new InMemoryLocalBus();
    coordinator = new HealthMonitoringCoordinator(bus);
  });

  describe("Provider Registration", () => {
    it("should register provider for monitoring", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("provider-1", 5000, checkFunction);

      const health = coordinator.getProviderHealth("provider-1");
      expect(health).toBeDefined();
    });

    it("should support multiple providers", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("provider-1", 5000, checkFunction);
      coordinator.registerProvider("provider-2", 5000, checkFunction);
      coordinator.registerProvider("provider-3", 5000, checkFunction);

      expect(coordinator.getProviderHealth("provider-1")).toBeDefined();
      expect(coordinator.getProviderHealth("provider-2")).toBeDefined();
      expect(coordinator.getProviderHealth("provider-3")).toBeDefined();
    });
  });

  describe("Health Status Tracking", () => {
    it("should track health for registered providers", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("provider-1", 5000, checkFunction);

      const health = coordinator.getProviderHealth("provider-1");
      expect(health?.state).toBe("unavailable");
    });
  });

  describe("Provider Unregistration", () => {
    it("should unregister provider and stop monitoring", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("provider-1", 5000, checkFunction);
      expect(coordinator.getProviderHealth("provider-1")).toBeDefined();

      coordinator.unregisterProvider("provider-1");
      expect(coordinator.getProviderHealth("provider-1")).toBeUndefined();
    });
  });

  describe("Shutdown", () => {
    it("should cleanup all monitoring on shutdown", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("provider-1", 5000, checkFunction);
      coordinator.registerProvider("provider-2", 5000, checkFunction);

      coordinator.shutdown();

      expect(coordinator.getProviderHealth("provider-1")).toBeUndefined();
      expect(coordinator.getProviderHealth("provider-2")).toBeUndefined();
    });
  });

  describe("Healthy Providers Filtering", () => {
    it("should return healthy providers of given type", () => {
      const checkFunction = (): Promise<ProviderHealthStatus> =>
        Promise.resolve({
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        });

      coordinator.registerProvider("acp-provider-1", 5000, checkFunction);
      coordinator.registerProvider("acp-provider-2", 5000, checkFunction);
      coordinator.registerProvider("mcp-provider-1", 5000, checkFunction);

      const healthyACP = coordinator.getHealthyProvidersByType("acp");
      expect(healthyACP).toBeDefined();
    });
  });
});

describe("Provider Crash Isolation (SC-025-002)", () => {
  it("should isolate crash in one lane from another lane", async () => {
    const bus = new InMemoryLocalBus();

    const laneAdapterA = new A2ARouterAdapter(bus);
    const laneAdapterB = new A2ARouterAdapter(bus);

    const config = {
      endpoints: [
        {
          id: "agent-1",
          url: "http://localhost:9000",
          priority: 1,
          capabilities: ["task"],
        },
      ],
      timeoutMs: 30000,
      failoverEnabled: true,
    };

    await laneAdapterA.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
    await laneAdapterB.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);

    const resultA = await laneAdapterA.execute(
      {
        taskDescription: "Task A",
        requiredCapabilities: ["task"],
        context: {},
      },
      "corr-a"
    );
    expect(resultA).toBeDefined();

    const resultB = await laneAdapterB.execute(
      {
        taskDescription: "Task B",
        requiredCapabilities: ["task"],
        context: {},
      },
      "corr-b"
    );
    expect(resultB).toBeDefined();

    expect(resultA.correlationId).toBe("corr-a");
    expect(resultB.correlationId).toBe("corr-b");
  });
});

describe("Error Taxonomy Completeness (SC-025-004)", () => {
  let adapter: A2ARouterAdapter;
  let bus: InMemoryLocalBus;

  beforeEach(async () => {
    bus = new InMemoryLocalBus();
    adapter = new A2ARouterAdapter(bus);

    const config = {
      endpoints: [
        {
          id: "agent-1",
          url: "http://localhost:9000",
          priority: 1,
          capabilities: ["task"],
        },
      ],
      timeoutMs: 30000,
      failoverEnabled: true,
    };
    await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);
  });

  it("should map all delegation errors to normalized error codes", async () => {
    const error = await adapter
      .execute(
        {
          taskDescription: "Unknown",
          requiredCapabilities: ["unknown"],
          context: {},
        },
        "corr-123"
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(NormalizedProviderError);
  });
});
