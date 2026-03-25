/**
 * A2A Router initialization tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryLocalBus } from "../../protocol/bus.js";
import { A2ARouterAdapter } from "../a2a-router.js";

type RouterConfig = {
  endpoints: Array<{ id: string; url: string; priority: number; capabilities: string[] }>;
  timeoutMs: number;
  failoverEnabled: boolean;
};

describe("A2A Router Adapter: Initialization", () => {
  let adapter: A2ARouterAdapter;
  let bus: InMemoryLocalBus;

  beforeEach(() => {
    bus = new InMemoryLocalBus();
    adapter = new A2ARouterAdapter(bus);
  });

  it("should initialize with valid endpoints", async () => {
    const config: RouterConfig = {
      endpoints: [
        {
          id: "agent-1",
          url: "http://localhost:9000",
          priority: 1,
          capabilities: ["task-execution", "inference"],
        },
        {
          id: "agent-2",
          url: "http://localhost:9001",
          priority: 2,
          capabilities: ["task-execution"],
        },
      ],
      timeoutMs: 30000,
      failoverEnabled: true,
    };

    await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);

    const health = await adapter.health();
    expect(health.state).toBe("healthy");
  });

  it("should reject missing endpoints", async () => {
    const config: RouterConfig = {
      endpoints: [],
      timeoutMs: 30000,
      failoverEnabled: true,
    };

    await expect(
      adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0])
    ).rejects.toThrow(/init failed/i);
  });

  it("should sort endpoints by priority", async () => {
    const config: RouterConfig = {
      endpoints: [
        {
          id: "agent-3",
          url: "http://localhost:9002",
          priority: 3,
          capabilities: [],
        },
        {
          id: "agent-1",
          url: "http://localhost:9000",
          priority: 1,
          capabilities: [],
        },
        {
          id: "agent-2",
          url: "http://localhost:9001",
          priority: 2,
          capabilities: [],
        },
      ],
      timeoutMs: 30000,
      failoverEnabled: true,
    };

    await adapter.init(config as unknown as Parameters<A2ARouterAdapter["init"]>[0]);

    const endpoints = adapter.getEndpoints();
    expect(endpoints[0].id).toBe("agent-1");
    expect(endpoints[1].id).toBe("agent-2");
    expect(endpoints[2].id).toBe("agent-3");
  });

  it("should emit initialization event", async () => {
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

    const events = bus.getEvents();
    const initEvent = events.find(e => e.topic === "provider.a2a.initialized");
    expect(initEvent).toBeDefined();
    expect(initEvent?.payload?.endpointCount).toBe(1);
  });
});
