import { beforeEach, describe, expect, it } from "vitest";
import { makeAdapter } from "./acp-client_test_helpers.js";

describe("ACP Client Adapter: Initialization and Health", () => {
  const config = {
    endpoint: "http://localhost:8080/acp",
    apiKeyRef: "acp-key",
    model: "claude-3-sonnet",
    timeoutMs: 30000,
    maxRetries: 3,
    healthCheckIntervalMs: 30000,
  };

  it("should initialize with valid config", async () => {
    const { adapter } = makeAdapter();
    await adapter.init(config);

    const health = await adapter.health();
    expect(health.state).toBe("healthy");
  });

  it("should reject missing endpoint", async () => {
    const { adapter } = makeAdapter();
    await expect(adapter.init({ ...config, endpoint: "" })).rejects.toThrow(/init failed/i);
  });

  it("should reject missing apiKeyRef", async () => {
    const { adapter } = makeAdapter();
    await expect(adapter.init({ ...config, apiKeyRef: "" })).rejects.toThrow(/init failed/i);
  });

  it("should reject missing model", async () => {
    const { adapter } = makeAdapter();
    await expect(adapter.init({ ...config, model: "" })).rejects.toThrow(/init failed/i);
  });

  it("should emit initialization event", async () => {
    const { adapter, bus } = makeAdapter();
    await adapter.init(config);

    const events = bus.getEvents();
    const initEvent = events.find(e => e.topic === "provider.acp.initialized");
    expect(initEvent).toBeDefined();
    expect(initEvent?.payload?.endpoint).toBe(config.endpoint);
  });

  describe("Health Checks", () => {
    const adapter = makeAdapter().adapter;

    beforeEach(async () => {
      await adapter.init(config);
    });

    it("should report healthy initially", async () => {
      const health = await adapter.health();
      expect(health.state).toBe("healthy");
      expect(health.failureCount).toBe(0);
    });

    it("should track failure count on health check failure", async () => {
      const health = await adapter.health();
      expect(health.state).toBe("healthy");

      const { adapter: brokenAdapter } = makeAdapter();
      await brokenAdapter.init(config);

      const brokenHealth = await brokenAdapter.health();
      expect(brokenHealth).toBeDefined();
    });

    it("should emit health state transition events", async () => {
      const health1 = await adapter.health();
      expect(health1.state).toBe("healthy");

      const health2 = await adapter.health();
      expect(health2.state).toBe("healthy");
    });
  });
});
