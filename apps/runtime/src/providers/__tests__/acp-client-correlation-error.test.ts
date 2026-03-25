import { describe, it, expect, beforeEach } from "vitest";
import { NormalizedProviderError } from "../errors.js";
import { makeAdapter } from "./acp-client_test_helpers.js";

describe("ACP Client Adapter: Correlation ID Propagation and Error Handling", () => {
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

  describe("Correlation ID Propagation", () => {
    it("should include correlation ID in all bus events", async () => {
      const correlationId = "unique-trace-id";
      await adapter.execute({ prompt: "Test" }, correlationId);

      const events = bus.getEvents();
      const relevantEvents = events.filter((e) =>
        e.topic?.startsWith("provider.acp.execute")
      );

      for (const event of relevantEvents) {
        expect(event.payload?.correlationId).toBe(correlationId);
      }
    });

    it("should preserve correlation ID through error cases", async () => {
      policyGate.setShouldDeny(true);
      const correlationId = "error-trace-id";

      try {
        await adapter.execute({ prompt: "Test" }, correlationId);
      } catch (e) {
        if (e instanceof NormalizedProviderError) {
          expect(e.correlationId).toBe(correlationId);
        }
      }

      const events = bus.getEvents();
      const policyEvent = events.find((e) => e.topic === "provider.acp.policy.denied");
      expect(policyEvent?.payload?.correlationId).toBe(correlationId);
    });
  });

  describe("Error Handling", () => {
    const timeoutConfig = {
      ...config,
      timeoutMs: 100,
    };

    beforeEach(async () => {
      await adapter.init(timeoutConfig);
    });

    it("should throw NormalizedProviderError on policy denial", async () => {
      policyGate.setShouldDeny(true);

      const error = await adapter.execute({ prompt: "Test" }, "corr-123").catch((e) => e);

      expect(error).toBeInstanceOf(NormalizedProviderError);
      expect((error as NormalizedProviderError).code).toBe("PROVIDER_POLICY_DENIED");
      expect((error as NormalizedProviderError).retryable).toBe(false);
    });

    it("should emit error event on execution failure", async () => {
      policyGate.setShouldDeny(true);
      bus.getEvents();

      try {
        await adapter.execute({ prompt: "Test" }, "corr-123");
      } catch {
        // Expected
      }

      const events = bus.getEvents();
      const errorEvent = events.find((e) => e.topic === "provider.acp.execute.failed");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.payload?.retryable).toBeDefined();
    });
  });
});
