import { InMemoryLocalBus } from "../../protocol/bus.js";
import { ProviderRegistry } from "../registry.js";
import type {
  ACPConfig,
  ACPExecuteInput,
  ACPExecuteOutput,
  ProviderAdapter,
  ProviderHealthStatus,
  ProviderRegistration,
} from "../adapter.js";

export class TestProvider
  implements ProviderAdapter<ACPConfig, ACPExecuteInput, ACPExecuteOutput>
{
  private initialized = false;

  async init(config: ACPConfig): Promise<void> {
    if (!config.apiKeyRef) {
      throw new Error("Missing API key ref");
    }
    this.initialized = true;
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      state: this.initialized ? "healthy" : "unavailable",
      lastCheck: new Date(),
      failureCount: 0,
    };
  }

  async execute(_input: ACPExecuteInput, _correlationId: string): Promise<ACPExecuteOutput> {
    if (!this.initialized) {
      throw new Error("Not initialized");
    }
    return {
      content: "Test response",
      stopReason: "end_turn",
    };
  }

  async terminate(): Promise<void> {
    this.initialized = false;
  }
}

export function makeRegistry() {
  const bus = new InMemoryLocalBus();
  return {
    bus,
    registry: new ProviderRegistry(bus),
  };
}

export function makeRegistration(id: string, type: "acp" | "mcp" = "acp", workspaceId = "ws-1"): ProviderRegistration<ACPConfig> {
  return {
    id,
    type,
    config: {
      endpoint: "http://localhost:8080/acp",
      apiKeyRef: "acp-key",
      model: "claude-3-sonnet",
    },
    workspaceId,
    concurrencyLimit: 10,
    healthCheckIntervalMs: 30000,
  };
}
