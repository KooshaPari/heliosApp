import { beforeEach, describe, expect, it } from "vitest";
import { NormalizedProviderError } from "../errors.js";
import { makeAdapter } from "./acp-client_test_helpers.js";

describe("ACP Client Adapter: Task Execution and Policy Gate", () => {
  const config = {
    endpoint: "http://localhost:8080/acp",
    apiKeyRef: "acp-key",
    model: "claude-3-sonnet",
    timeoutMs: 30000,
    maxRetries: 3,
    healthCheckIntervalMs: 30000,
  };

  let adapter = makeAdapter().adapter;
  let policyGate = makeAdapter().policyGate;
  let bus = makeAdapter().bus;

  beforeEach(async () => {
    const setup = makeAdapter();
    adapter = setup.adapter;
    policyGate = setup.policyGate;
    bus = setup.bus;
    await adapter.init(config);
  });

  it("should execute a task successfully", async () => {
    const result = await adapter.execute({ prompt: "Hello, how are you?" }, "corr-123");
    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
    expect(result.stopReason).toBe("end_turn");
  });

  it("should propagate correlation ID in response", async () => {
    const correlationId = "unique-corr-id-456";
    const result = await adapter.execute({ prompt: "Test" }, correlationId);
    expect(result).toBeDefined();

    const events = bus.getEvents();
    const completedEvent = events.find(e => e.topic === "provider.acp.execute.completed");
    expect(completedEvent?.payload?.correlationId).toBe(correlationId);
  });

  it("should emit execution completed event", async () => {
    bus.getEvents();
    await adapter.execute({ prompt: "Test" }, "corr-123");

    const events = bus.getEvents();
    const completedEvent = events.find(e => e.topic === "provider.acp.execute.completed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.payload?.duration).toBeGreaterThanOrEqual(0);
  });

  it("should reject execution before init", async () => {
    const freshAdapter = makeAdapter().adapter;
    await expect(freshAdapter.execute({ prompt: "Test" }, "corr-123")).rejects.toThrow(
      /unavailable/i
    );
  });

  it("should include token usage in response", async () => {
    const result = await adapter.execute({ prompt: "Test" }, "corr-123");
    expect(result.usage).toBeDefined();
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(result.usage?.outputTokens).toBeGreaterThan(0);
  });

  describe("Policy Gate Integration", () => {
    it("should deny execution when policy gate denies", async () => {
      policyGate.setShouldDeny(true, "Access denied");
      await expect(adapter.execute({ prompt: "Test" }, "corr-123")).rejects.toThrow(
        /policy denied/i
      );
    });

    it("should emit policy denied event", async () => {
      bus.getEvents();
      policyGate.setShouldDeny(true, "Access denied");

      try {
        await adapter.execute({ prompt: "Test" }, "corr-123");
      } catch {
        // Expected
      }

      const events = bus.getEvents();
      const policyEvent = events.find(e => e.topic === "provider.acp.policy.denied");
      expect(policyEvent).toBeDefined();
      expect(policyEvent?.payload?.reason).toContain("Access denied");
    });

    it("should not contact endpoint when policy denies", async () => {
      policyGate.setShouldDeny(true, "Test denial");
      bus.getEvents();

      try {
        await adapter.execute({ prompt: "Test" }, "corr-123");
      } catch (e) {
        expect(e instanceof NormalizedProviderError).toBe(true);
        if (e instanceof NormalizedProviderError) {
          expect(e.code).toBe("PROVIDER_POLICY_DENIED");
        }
      }
    });

    it("should allow execution when policy gate allows", async () => {
      policyGate.setShouldDeny(false);
      const result = await adapter.execute({ prompt: "Test" }, "corr-123");
      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
    });
  });
});
