import { describe, expect, it } from "vitest";
import { NormalizedProviderError } from "../errors.js";
import { TestProvider, makeRegistration, makeRegistry } from "./registry_test_helpers.js";

describe("ProviderRegistry: Concurrency Limit Enforcement", () => {
  it("should allow execution up to concurrency limit", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(
      {
        ...makeRegistration("test-provider"),
        concurrencyLimit: 3,
      },
      adapter
    );

    registry.checkConcurrencyLimit("test-provider");
    registry.incrementInFlight("test-provider");
    registry.checkConcurrencyLimit("test-provider");
    registry.incrementInFlight("test-provider");
    registry.checkConcurrencyLimit("test-provider");
    registry.incrementInFlight("test-provider");

    expect(() => registry.checkConcurrencyLimit("test-provider")).toThrow(/concurrency limit/i);
  });

  it("should reject execution exceeding concurrency limit", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(
      {
        ...makeRegistration("test-provider"),
        concurrencyLimit: 1,
      },
      adapter
    );

    registry.checkConcurrencyLimit("test-provider");
    registry.incrementInFlight("test-provider");

    expect(() => registry.checkConcurrencyLimit("test-provider")).toThrow(NormalizedProviderError);
  });

  it("should allow reuse of slots after decrement", async () => {
    const { registry } = makeRegistry();
    const adapter = new TestProvider();
    await registry.register(
      {
        ...makeRegistration("test-provider"),
        concurrencyLimit: 1,
      },
      adapter
    );

    registry.checkConcurrencyLimit("test-provider");
    registry.incrementInFlight("test-provider");
    expect(() => registry.checkConcurrencyLimit("test-provider")).toThrow();

    registry.decrementInFlight("test-provider");
    registry.checkConcurrencyLimit("test-provider");
  });
});
