import type { LocalBus } from "../protocol/bus.js";
import { publishA2AEvent } from "./a2a-router_helpers.js";
import type { ProviderHealthStatus } from "./adapter.js";

/**
 * Health Monitoring Coordinator
 *
 * Manages health state for all registered providers across all types (ACP, MCP, A2A).
 * Publishes state transitions on the bus and coordinates failover decisions.
 *
 * FR-025-009: Health monitoring for all providers.
 * FR-025-010: Failover routing based on health state.
 */
export class HealthMonitoringCoordinator {
  private providerHealthMap = new Map<string, ProviderHealthStatus>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private bus: LocalBus | null = null;

  constructor(bus?: LocalBus) {
    this.bus = bus || null;
  }

  registerProvider(
    providerId: string,
    interval: number,
    checkFunction: () => Promise<ProviderHealthStatus>
  ): void {
    this.providerHealthMap.set(providerId, {
      state: "unavailable",
      lastCheck: new Date(),
      failureCount: 0,
    });

    const intervalId = setInterval(async () => {
      try {
        const status = await checkFunction();
        const previousStatus = this.providerHealthMap.get(providerId);

        this.providerHealthMap.set(providerId, status);

        if (previousStatus?.state !== status.state) {
          await publishA2AEvent(
            this.bus,
            "provider.health.transitioned",
            {
              providerId,
              previousState: previousStatus?.state,
              newState: status.state,
              failureCount: status.failureCount,
            },
            "health"
          );
        }
      } catch (_error) {
        // Health polling errors are intentionally isolated per interval tick.
      }
    }, interval);

    this.healthCheckIntervals.set(providerId, intervalId);
  }

  unregisterProvider(providerId: string): void {
    const intervalId = this.healthCheckIntervals.get(providerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(providerId);
    }
    this.providerHealthMap.delete(providerId);
  }

  getProviderHealth(providerId: string): ProviderHealthStatus | undefined {
    return this.providerHealthMap.get(providerId);
  }

  getHealthyProvidersByType(type: string): string[] {
    const providers: string[] = [];
    for (const [providerId, status] of this.providerHealthMap) {
      if (providerId.startsWith(type) && status.state === "healthy") {
        providers.push(providerId);
      }
    }
    return providers;
  }

  shutdown(): void {
    for (const intervalId of this.healthCheckIntervals.values()) {
      clearInterval(intervalId);
    }
    this.healthCheckIntervals.clear();
    this.providerHealthMap.clear();
  }
}
