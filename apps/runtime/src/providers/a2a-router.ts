/**
 * A2A Federation Router, Health Monitoring, and Failover
 *
 * Implements the A2A protocol client adapter for external agent delegation
 * with endpoint registration, failover routing, and failure isolation.
 *
 * FR-025-005: A2A federation with failure isolation.
 * FR-025-010: Failover routing for degraded providers.
 */

import type { LocalBus } from "../protocol/bus.js";
import {
  type A2ADelegation,
  type A2AEndpoint,
  type A2AResult,
  type A2ARouterConfig,
  createA2AEndpoints,
  probeA2AEndpoint,
  publishA2AEvent,
  selectA2AEndpoint,
  sendA2ADelegation,
} from "./a2a-router_helpers.js";
import type { ProviderAdapter, ProviderHealthStatus } from "./adapter.js";
import { NormalizedProviderError, normalizeError } from "./errors.js";
export type {
  A2ADelegation,
  A2AEndpoint,
  A2ARouterConfig,
  A2AResult,
} from "./a2a-router_helpers.js";
export { HealthMonitoringCoordinator } from "./a2a-health-coordinator.js";

/**
 * A2A Router Adapter
 *
 * Routes delegations to external agents via A2A protocol with:
 * - Endpoint registration and capability matching
 * - Health-aware routing
 * - Failure isolation per lane
 * - Failover support (slice-1: single endpoint, slice-2: multi-endpoint)
 *
 * FR-025-005: A2A federation with external agent delegation.
 */
// biome-ignore lint/style/useNamingConvention: A2A acronym is part of the external provider protocol name.
export class A2ARouterAdapter
  implements ProviderAdapter<A2ARouterConfig, A2ADelegation & { correlationId?: string }, A2AResult>
{
  private config: A2ARouterConfig | null = null;
  private bus: LocalBus | null = null;
  private endpoints: A2AEndpoint[] = [];
  private healthStatus: ProviderHealthStatus = {
    state: "unavailable",
    lastCheck: new Date(),
    failureCount: 0,
  };
  private inFlightDelegations = new Map<string, AbortController>();

  constructor(bus?: LocalBus) {
    this.bus = bus || null;
  }

  /**
   * Initialize A2A router with endpoint configuration.
   *
   * FR-025-005: A2A router initialization.
   *
   * @param config A2A router configuration
   * @throws NormalizedProviderError if init fails
   */
  async init(config: A2ARouterConfig): Promise<void> {
    try {
      // Validate config
      if (!(config.endpoints && Array.isArray(config.endpoints)) || config.endpoints.length === 0) {
        throw new Error("Missing or invalid endpoints");
      }

      this.config = config;

      // Initialize endpoints sorted by priority
      this.endpoints = createA2AEndpoints(config.endpoints);

      // Perform initial health probes
      for (const endpoint of this.endpoints) {
        try {
          await probeA2AEndpoint(endpoint);
        } catch (error) {
          endpoint.healthStatus = {
            state: "unavailable",
            lastCheck: new Date(),
            failureCount: 1,
            message: `Probe failed: ${normalizeError(error, "a2a").message}`,
          };
        }
      }

      this.healthStatus = {
        state: "healthy",
        lastCheck: new Date(),
        failureCount: 0,
      };

      await publishA2AEvent(
        this.bus,
        "provider.a2a.initialized",
        {
          endpointCount: this.endpoints.length,
        },
        "a2a"
      );
    } catch (error) {
      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `A2A router init failed: ${normalizeError(error, "a2a").message}`,
        "a2a",
        false
      );
    }
  }

  /**
   * Get current health status.
   *
   * @returns Current health status
   */
  async health(): Promise<ProviderHealthStatus> {
    if (!this.config) {
      return {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Not initialized",
      };
    }

    try {
      // Check if any endpoint is healthy
      const healthyEndpoints = this.endpoints.filter(ep => ep.healthStatus?.state === "healthy");

      if (healthyEndpoints.length > 0) {
        this.healthStatus = {
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        };
      } else {
        this.healthStatus.failureCount++;
        const newState = this.healthStatus.failureCount >= 5 ? "unavailable" : "degraded";
        this.healthStatus = {
          state: newState,
          lastCheck: new Date(),
          failureCount: this.healthStatus.failureCount,
          message: "No healthy endpoints available",
        };
      }
    } catch (error) {
      this.healthStatus.failureCount++;
      this.healthStatus = {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: this.healthStatus.failureCount,
        message: `Health check failed: ${normalizeError(error, "a2a").message}`,
      };
    }

    return { ...this.healthStatus };
  }

  /**
   * Execute a delegation request.
   *
   * FR-025-005: A2A task delegation with failure isolation.
   * FR-025-010: Failover to healthy endpoint.
   *
   * @param input Delegation request
   * @param correlationId Correlation ID for tracing
   * @returns Delegation result
   * @throws NormalizedProviderError on failure
   */
  async execute(
    input: A2ADelegation & { correlationId?: string },
    correlationId: string
  ): Promise<A2AResult> {
    if (!this.config || this.endpoints.length === 0) {
      throw new NormalizedProviderError(
        "PROVIDER_UNAVAILABLE",
        "A2A router unavailable or no endpoints configured",
        "a2a"
      );
    }

    try {
      // Select endpoint by matching capabilities (FR-025-010: failover)
      const selectedEndpoint = selectA2AEndpoint(this.endpoints, input.requiredCapabilities);

      if (!selectedEndpoint) {
        throw new Error(
          `No endpoint found with required capabilities: ${input.requiredCapabilities.join(", ")}`
        );
      }

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutMs = this.config.timeoutMs || 30000;
      const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
      this.inFlightDelegations.set(correlationId, abortController);

      try {
        const startTime = Date.now();

        // Send delegation request
        const result = await sendA2ADelegation(selectedEndpoint, input, abortController.signal);

        const duration = Date.now() - startTime;

        // Publish success event
        await publishA2AEvent(
          this.bus,
          "provider.a2a.delegation.completed",
          {
            correlationId,
            endpointId: selectedEndpoint.id,
            duration,
          },
          "a2a"
        );

        return {
          endpointId: selectedEndpoint.id,
          result,
          correlationId,
          duration,
        };
      } finally {
        clearTimeout(timeoutHandle);
        this.inFlightDelegations.delete(correlationId);
      }
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === "AbortError") {
        const normalized = new NormalizedProviderError(
          "PROVIDER_TIMEOUT",
          `A2A delegation timeout after ${this.config?.timeoutMs || 30000}ms`,
          "a2a",
          true,
          correlationId
        );

        await publishA2AEvent(
          this.bus,
          "provider.a2a.delegation.failed",
          {
            correlationId,
            code: normalized.code,
            message: normalized.message,
          },
          "a2a"
        );

        throw normalized;
      }

      // Handle other errors
      const normalized = normalizeError(error, "a2a", correlationId);

      await publishA2AEvent(
        this.bus,
        "provider.a2a.delegation.failed",
        {
          correlationId,
          code: normalized.code,
          message: normalized.message,
        },
        "a2a"
      );

      throw normalized;
    }
  }

  /**
   * Terminate A2A router and cleanup resources.
   */
  async terminate(): Promise<void> {
    try {
      // Cancel all in-flight delegations
      for (const controller of this.inFlightDelegations.values()) {
        controller.abort();
      }
      this.inFlightDelegations.clear();

      // Clear endpoints
      this.endpoints = [];
      this.config = null;

      this.healthStatus = {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Terminated",
      };

      await publishA2AEvent(this.bus, "provider.a2a.terminated", {}, "a2a");
    } catch (error) {
      const normalized = normalizeError(error, "a2a");

      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `Failed to terminate A2A router: ${normalized.message}`,
        "a2a",
        false
      );
    }
  }

  /**
   * Get all endpoints.
   *
   * @returns Array of endpoints
   */
  getEndpoints(): A2AEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Update endpoint health status.
   *
   * @param endpointId Endpoint ID
   * @param status New health status
   */
  updateEndpointHealth(endpointId: string, status: ProviderHealthStatus): void {
    const endpoint = this.endpoints.find(ep => ep.id === endpointId);
    if (endpoint) {
      endpoint.healthStatus = status;
    }
  }
}
