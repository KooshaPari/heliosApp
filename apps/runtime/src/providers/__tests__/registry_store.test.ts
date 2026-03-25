import { describe, expect, it } from "vitest";
import type {
  ACPConfig,
  ACPExecuteInput,
  ACPExecuteOutput,
  ProviderAdapter,
  ProviderHealthStatus,
  ProviderRegistration,
} from "../adapter.js";
import { ProviderRegistryStore, type RegisteredProvider } from "../registry_store.js";

class TestProvider implements ProviderAdapter<ACPConfig, ACPExecuteInput, ACPExecuteOutput> {
  async init(_config: ACPConfig): Promise<void> {}

  async health(): Promise<ProviderHealthStatus> {
    return { state: "healthy", lastCheck: new Date(), failureCount: 0 };
  }

  async execute(_input: ACPExecuteInput, _correlationId: string): Promise<ACPExecuteOutput> {
    return { content: "ok", stopReason: "end_turn" };
  }

  async terminate(): Promise<void> {}
}

function createRegisteredProvider(
  id: string,
  type: "acp" | "mcp" | "a2a",
  workspaceId: string
): RegisteredProvider {
  const registration: ProviderRegistration<ACPConfig> = {
    id,
    type,
    workspaceId,
    concurrencyLimit: 5,
    healthCheckIntervalMs: 30000,
    config: {
      endpoint: "http://localhost:8080/acp",
      apiKeyRef: "acp-key",
      model: "claude-3-sonnet",
    },
  };

  return {
    id,
    type,
    adapter: new TestProvider(),
    registration,
    healthStatus: { state: "healthy", lastCheck: new Date(), failureCount: 0 },
    inFlightCount: 0,
    laneIds: new Set<string>(),
  };
}

describe("ProviderRegistryStore", () => {
  it("stores and retrieves providers by id/type/workspace", () => {
    const store = new ProviderRegistryStore();
    const acp = createRegisteredProvider("acp-1", "acp", "ws-1");
    const mcp = createRegisteredProvider("mcp-1", "mcp", "ws-2");
    store.set(acp);
    store.set(mcp);

    expect(store.getAdapter("acp-1")).toBe(acp.adapter);
    expect(store.listAdaptersByType("acp")).toEqual([acp.adapter]);
    expect(store.listAdaptersByWorkspace("ws-2")).toEqual([mcp.adapter]);
  });

  it("tracks lane bindings and provider ids per lane", () => {
    const store = new ProviderRegistryStore();
    const provider = createRegisteredProvider("provider-1", "acp", "ws-1");
    store.set(provider);

    expect(store.bindToLane("provider-1", "lane-1")).toBe(true);
    expect(store.getProvidersForLane("lane-1")).toEqual(["provider-1"]);

    store.unbindFromLane("provider-1", "lane-1");
    expect(store.getProvidersForLane("lane-1")).toEqual([]);
    expect(store.bindToLane("unknown", "lane-1")).toBe(false);
  });

  it("tracks in-flight counters and health updates", () => {
    const store = new ProviderRegistryStore();
    const provider = createRegisteredProvider("provider-1", "acp", "ws-1");
    store.set(provider);

    store.incrementInFlight("provider-1");
    store.incrementInFlight("provider-1");
    expect(store.getRecord("provider-1")?.inFlightCount).toBe(2);

    store.decrementInFlight("provider-1");
    store.decrementInFlight("provider-1");
    store.decrementInFlight("provider-1");
    expect(store.getRecord("provider-1")?.inFlightCount).toBe(0);

    const degraded: ProviderHealthStatus = {
      state: "degraded",
      lastCheck: new Date(),
      failureCount: 2,
      message: "degraded",
    };
    store.updateHealthStatus("provider-1", degraded);
    expect(store.getHealthStatus("provider-1")).toEqual(degraded);
  });
});
