import type { ProviderAdapter, ProviderHealthStatus, ProviderRegistration } from "./adapter.js";

export interface RegisteredProvider {
  id: string;
  type: "acp" | "mcp" | "a2a";
  adapter: ProviderAdapter<any, any, any>;
  registration: ProviderRegistration<any>;
  healthStatus: ProviderHealthStatus;
  inFlightCount: number;
  laneIds: Set<string>;
}

export class ProviderRegistryStore {
  private readonly providers = new Map<string, RegisteredProvider>();

  set(provider: RegisteredProvider): void {
    this.providers.set(provider.id, provider);
  }

  delete(providerId: string): void {
    this.providers.delete(providerId);
  }

  getRecord(providerId: string): RegisteredProvider | undefined {
    return this.providers.get(providerId);
  }

  getAdapter(providerId: string): ProviderAdapter<any, any, any> | undefined {
    return this.providers.get(providerId)?.adapter;
  }

  listAdaptersByType(type: "acp" | "mcp" | "a2a"): ProviderAdapter<any, any, any>[] {
    const result: ProviderAdapter<any, any, any>[] = [];
    for (const provider of this.providers.values()) {
      if (provider.type === type) {
        result.push(provider.adapter);
      }
    }
    return result;
  }

  listAdaptersByWorkspace(workspaceId: string): ProviderAdapter<any, any, any>[] {
    const result: ProviderAdapter<any, any, any>[] = [];
    for (const provider of this.providers.values()) {
      if (provider.registration.workspaceId === workspaceId) {
        result.push(provider.adapter);
      }
    }
    return result;
  }

  bindToLane(providerId: string, laneId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    provider.laneIds.add(laneId);
    return true;
  }

  unbindFromLane(providerId: string, laneId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.laneIds.delete(laneId);
    }
  }

  getProvidersForLane(laneId: string): string[] {
    const result: string[] = [];
    for (const provider of this.providers.values()) {
      if (provider.laneIds.has(laneId)) {
        result.push(provider.id);
      }
    }
    return result;
  }

  incrementInFlight(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.inFlightCount += 1;
    }
  }

  decrementInFlight(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider && provider.inFlightCount > 0) {
      provider.inFlightCount -= 1;
    }
  }

  updateHealthStatus(providerId: string, status: ProviderHealthStatus): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.healthStatus = status;
    }
  }

  getHealthStatus(providerId: string): ProviderHealthStatus | undefined {
    return this.providers.get(providerId)?.healthStatus;
  }
}
