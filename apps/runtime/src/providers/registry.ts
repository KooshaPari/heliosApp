/**
 * Provider Registry and Lifecycle Management
 *
 * Manages provider registrations with validation, credential binding,
 * and lifecycle tracking. Enforces concurrency limits and emits
 * lifecycle events on the protocol bus.
 *
 * FR-025-002: Provider registration with validation and credential binding.
 * FR-025-008: Binding providers to lanes for failure isolation.
 */

import type { LocalBus } from "../protocol/bus.js";
import type { ProviderAdapter, ProviderRegistration, ProviderHealthStatus } from "./adapter.js";
import { ProviderRegistryStore, type RegisteredProvider } from "./registry_store.js";
import { validateProviderRegistration } from "./registry_validation.js";
import {
  NormalizedProviderError,
  normalizeError,
} from "./errors.js";

/**
 * Provider Registry
 *
 * Manages provider registrations, validation, credential binding,
 * and lifecycle. Enforces concurrency limits and publishes events
 * on the protocol bus.
 *
 * FR-025-002: Configuration validation, credential binding, lifecycle tracking.
 */
export class ProviderRegistry {
  /** Provider state/query store */
  private readonly store = new ProviderRegistryStore();

  /** Reference to the protocol bus for event publishing */
  private bus: LocalBus | null = null;

  constructor(bus?: LocalBus) {
    this.bus = bus || null;
  }

  /**
   * Register a provider with the registry.
   *
   * Steps:
   * 1. Validate registration configuration (required fields, limits, intervals)
   * 2. Validate provider configuration schema
   * 3. Create adapter instance from provider type
   * 4. Call adapter.init() with validated config
   * 5. Add to registry and emit lifecycle event
   *
   * FR-025-002: Configuration validation and credential binding.
   *
   * @param registration Provider registration with config and metadata
   * @param adapter Pre-created adapter instance to manage
   * @throws NormalizedProviderError if validation fails or init fails
   */
  async register<TConfig, TInput, TOutput>(
    registration: ProviderRegistration<TConfig>,
    adapter: ProviderAdapter<TConfig, TInput, TOutput>
  ): Promise<void> {
    // Validate registration configuration
    validateProviderRegistration(registration);

    try {
      // Initialize adapter with validated config
      await adapter.init(registration.config);

      // Get initial health status
      const healthStatus = await adapter.health();

      // Create registered provider instance
      const registeredProvider: RegisteredProvider = {
        id: registration.id,
        type: registration.type,
        adapter,
        registration,
        healthStatus,
        inFlightCount: 0,
        laneIds: new Set(),
      };

      // Add to registry
      this.store.set(registeredProvider);

      // Emit lifecycle event
      await this.publishEvent("provider.registered", {
        providerId: registration.id,
        type: registration.type,
        workspaceId: registration.workspaceId,
      });
    } catch (error) {
      // Normalize error and emit failure event
      const normalized = normalizeError(error, "internal");

      await this.publishEvent("provider.init.failed", {
        providerId: registration.id,
        type: registration.type,
        workspaceId: registration.workspaceId,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      });

      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `Failed to register provider ${registration.id}: ${normalized.message}`,
        "internal",
        false,
        undefined,
        normalized instanceof Error ? normalized : undefined
      );
    }
  }

  /**
   * Unregister a provider and cleanup resources.
   *
   * FR-025-008: Lane binding cleanup.
   *
   * @param providerId ID of provider to unregister
   * @throws NormalizedProviderError if provider not found or terminate fails
   */
  async unregister(providerId: string): Promise<void> {
    const provider = this.store.getRecord(providerId);

    if (!provider) {
      throw new NormalizedProviderError(
        "PROVIDER_UNKNOWN",
        `Provider ${providerId} not found in registry`,
        "internal"
      );
    }

    try {
      // Terminate adapter and cleanup resources
      await provider.adapter.terminate();

      // Remove from registry
      this.store.delete(providerId);

      // Emit lifecycle event
      await this.publishEvent("provider.unregistered", {
        providerId: providerId,
        type: provider.type,
        workspaceId: provider.registration.workspaceId,
      });
    } catch (error) {
      const normalized = normalizeError(error, "internal");

      // Log error but still remove from registry (force cleanup)
      this.store.delete(providerId);

      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `Failed to unregister provider ${providerId}: ${normalized.message}`,
        "internal",
        false
      );
    }
  }

  /**
   * Get a registered provider by ID.
   *
   * @param providerId ID of provider to retrieve
   * @returns Registered provider or undefined if not found
   */
  get(providerId: string): ProviderAdapter<any, any, any> | undefined {
    return this.store.getAdapter(providerId);
  }

  /**
   * List all registered providers by type.
   *
   * @param type Provider type to filter by
   * @returns Array of adapters matching the type
   */
  listByType(type: "acp" | "mcp" | "a2a"): ProviderAdapter<any, any, any>[] {
    return this.store.listAdaptersByType(type);
  }

  /**
   * List all registered providers bound to a workspace.
   *
   * @param workspaceId Workspace ID to filter by
   * @returns Array of adapters bound to the workspace
   */
  listByWorkspace(workspaceId: string): ProviderAdapter<any, any, any>[] {
    return this.store.listAdaptersByWorkspace(workspaceId);
  }

  /**
   * Bind a provider to a lane for failure isolation.
   *
   * FR-025-008: Lane binding for process-level isolation.
   *
   * @param providerId Provider ID
   * @param laneId Lane ID
   */
  bindToLane(providerId: string, laneId: string): void {
    const bound = this.store.bindToLane(providerId, laneId);
    if (!bound) {
      throw new NormalizedProviderError(
        "PROVIDER_UNKNOWN",
        `Provider ${providerId} not found in registry`,
        "internal"
      );
    }
  }

  /**
   * Unbind a provider from a lane.
   *
   * @param providerId Provider ID
   * @param laneId Lane ID
   */
  unbindFromLane(providerId: string, laneId: string): void {
    this.store.unbindFromLane(providerId, laneId);
  }

  /**
   * Get all providers bound to a lane.
   *
   * @param laneId Lane ID
   * @returns Array of provider IDs bound to the lane
   */
  getProvidersForLane(laneId: string): string[] {
    return this.store.getProvidersForLane(laneId);
  }

  /**
   * Check and enforce concurrency limit for a provider.
   *
   * FR-025-002: Concurrency limit enforcement.
   *
   * @param providerId Provider ID
   * @throws NormalizedProviderError if limit exceeded
   */
  checkConcurrencyLimit(providerId: string): void {
    const provider = this.store.getRecord(providerId);

    if (!provider) {
      throw new NormalizedProviderError(
        "PROVIDER_UNKNOWN",
        `Provider ${providerId} not found`,
        "internal"
      );
    }

    if (provider.inFlightCount >= provider.registration.concurrencyLimit) {
      throw new NormalizedProviderError(
        "PROVIDER_CONCURRENCY_EXCEEDED",
        `Provider ${providerId} concurrency limit (${provider.registration.concurrencyLimit}) exceeded`,
        "internal"
      );
    }
  }

  /**
   * Increment in-flight count for a provider.
   *
   * @param providerId Provider ID
   */
  incrementInFlight(providerId: string): void {
    this.store.incrementInFlight(providerId);
  }

  /**
   * Decrement in-flight count for a provider.
   *
   * @param providerId Provider ID
   */
  decrementInFlight(providerId: string): void {
    this.store.decrementInFlight(providerId);
  }

  /**
   * Update health status for a provider.
   *
   * @param providerId Provider ID
   * @param status New health status
   */
  updateHealthStatus(providerId: string, status: ProviderHealthStatus): void {
    this.store.updateHealthStatus(providerId, status);
  }

  /**
   * Get health status for a provider.
   *
   * @param providerId Provider ID
   * @returns Health status or undefined if not found
   */
  getHealthStatus(providerId: string): ProviderHealthStatus | undefined {
    return this.store.getHealthStatus(providerId);
  }

  /**
   * Publish event on the protocol bus.
   *
   * @param topic Event topic
   * @param payload Event payload
   */
  private async publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.bus) {
      return; // Bus not configured, skip event publishing
    }

    try {
      await this.bus.publish({
        id: `provider-${Date.now()}-${Math.random()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic,
        payload,
      });
    } catch (error) {
      // Log error but don't throw (event publishing is best-effort)
      console.warn(`Failed to publish provider event ${topic}:`, error);
    }
  }
}
