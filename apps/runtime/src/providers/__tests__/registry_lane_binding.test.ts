import { describe, it, expect } from "vitest";
import { makeRegistration, makeRegistry, TestProvider } from "./registry_test_helpers.js";

describe("ProviderRegistry: Lane Binding and Health Status", () => {
  it("should bind provider to lane", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(makeRegistration("test-provider"), adapter);

    registry.bindToLane("test-provider", "lane-1");
    expect(registry.getProvidersForLane("lane-1")).toContain("test-provider");
  });

  it("should unbind provider from lane", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(makeRegistration("test-provider"), adapter);

    registry.bindToLane("test-provider", "lane-1");
    expect(registry.getProvidersForLane("lane-1")).toContain("test-provider");

    registry.unbindFromLane("test-provider", "lane-1");
    expect(registry.getProvidersForLane("lane-1")).not.toContain("test-provider");
  });

  it("should get all providers for a lane", async () => {
    const { registry } = makeRegistry();
    const adapter1 = new TestProvider();
    const adapter2 = new TestProvider();

    await registry.register(makeRegistration("provider-1", "acp"), adapter1);
    await registry.register(makeRegistration("provider-2", "mcp"), adapter2);

    registry.bindToLane("provider-1", "lane-1");
    registry.bindToLane("provider-2", "lane-1");

    const providers = registry.getProvidersForLane("lane-1");
    expect(providers).toHaveLength(2);
    expect(providers).toContain("provider-1");
    expect(providers).toContain("provider-2");
  });

  it("should update health status", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(makeRegistration("test-provider"), adapter);

    const status = {
      state: "degraded" as const,
      lastCheck: new Date(),
      failureCount: 2,
      message: "Slow response",
    };

    registry.updateHealthStatus("test-provider", status);

    const retrieved = registry.getHealthStatus("test-provider");
    expect(retrieved?.state).toBe("degraded");
    expect(retrieved?.failureCount).toBe(2);
  });
});
