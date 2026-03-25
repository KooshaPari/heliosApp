import { describe, it, expect } from "vitest";
import { makeRegistration, makeRegistry, TestProvider } from "./registry_test_helpers.js";

describe("ProviderRegistry: Registration and Unregistration", () => {
  it("should register a provider with valid config", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(makeRegistration("test-provider"), adapter);
    expect(registry.get("test-provider")).toBeDefined();
  });

  it("should reject registration with missing ID", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    const registration: any = {
      ...makeRegistration("test-provider"),
      id: null,
    };

    await expect(registry.register(registration, adapter)).rejects.toThrow(
      /missing required field: id/i
    );
  });

  it("should emit provider.registered event on successful registration", async () => {
    const { registry, bus } = makeRegistry();
    const adapter = new TestProvider();

    await registry.register(makeRegistration("test-provider"), adapter);

    const events = bus.getEvents();
    const registeredEvent = events.find((e) => e.topic === "provider.registered");
    expect(registeredEvent).toBeDefined();
    expect(registeredEvent?.payload?.providerId).toBe("test-provider");
  });

  it("should emit provider.init.failed event on init failure", async () => {
    class FailingProvider extends TestProvider {
      override async init(): Promise<void> {
        throw new Error("Init failed");
      }
    }

    const { registry, bus } = makeRegistry();
    const adapter = new FailingProvider();

    await expect(registry.register(makeRegistration("failing-provider"), adapter)).rejects.toThrow();

    const events = bus.getEvents();
    const failedEvent = events.find((e) => e.topic === "provider.init.failed");
    expect(failedEvent).toBeDefined();
  });

  it("should unregister a provider", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();

    await registry.register(makeRegistration("test-provider"), adapter);
    expect(registry.get("test-provider")).toBeDefined();

    await registry.unregister("test-provider");
    expect(registry.get("test-provider")).toBeUndefined();
  });

  it("should emit provider.unregistered event", async () => {
    const { registry, bus } = makeRegistry();
    const adapter = new TestProvider();

    await registry.register(makeRegistration("test-provider"), adapter);
    bus.getEvents();

    await registry.unregister("test-provider");

    const events = bus.getEvents();
    const unregisteredEvent = events.find((e) => e.topic === "provider.unregistered");
    expect(unregisteredEvent).toBeDefined();
  });

  it("should throw error when unregistering non-existent provider", async () => {
    const { registry } = makeRegistry();
    await expect(registry.unregister("non-existent")).rejects.toThrow(/not found/i);
  });
});
