/**
 * @helios/runtime — Core runtime package for heliosApp.
 *
 * Exports foundational types and utilities consumed by all other packages.
 */

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

const startTime = performance.now();

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
  };
}

// Re-export all services as a unified API
export * from "./services/index.js";

// Stub: createRuntime — full implementation pending spec 001 WP05
// Stub returns any — pending full implementation
export function createRuntime(..._args: any[]): any {
  return { bus: {} };
}
