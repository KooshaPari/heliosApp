import type { ProviderRegistration } from "./adapter.js";
import { NormalizedProviderError } from "./errors.js";

/**
 * Validate provider registration configuration.
 *
 * FR-025-002: Configuration validation.
 *
 * @param registration Registration to validate
 * @throws NormalizedProviderError if validation fails
 */
export function validateProviderRegistration<TConfig>(
  registration: ProviderRegistration<TConfig>
): void {
  if (!registration.id || typeof registration.id !== "string") {
    throw new NormalizedProviderError(
      "PROVIDER_INIT_FAILED",
      "Registration missing required field: id",
      "internal"
    );
  }

  if (!(registration.type && ["acp", "mcp", "a2a"].includes(registration.type))) {
    throw new NormalizedProviderError(
      "PROVIDER_INIT_FAILED",
      "Registration missing or invalid required field: type",
      "internal"
    );
  }

  if (!registration.workspaceId || typeof registration.workspaceId !== "string") {
    throw new NormalizedProviderError(
      "PROVIDER_INIT_FAILED",
      "Registration missing required field: workspaceId",
      "internal"
    );
  }

  if (
    typeof registration.concurrencyLimit !== "number" ||
    registration.concurrencyLimit < 1 ||
    registration.concurrencyLimit > 100
  ) {
    throw new NormalizedProviderError(
      "PROVIDER_INIT_FAILED",
      `Invalid concurrency limit: ${registration.concurrencyLimit} (must be 1-100)`,
      "internal"
    );
  }

  if (
    typeof registration.healthCheckIntervalMs !== "number" ||
    registration.healthCheckIntervalMs < 5000
  ) {
    throw new NormalizedProviderError(
      "PROVIDER_INIT_FAILED",
      `Invalid health check interval: ${registration.healthCheckIntervalMs} (minimum 5000ms)`,
      "internal"
    );
  }
}
