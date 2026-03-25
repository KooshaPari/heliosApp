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

// Re-export protocol types for consumer convenience
export { InMemoryLocalBus } from "./protocol/bus.ts";
export type { LocalBus } from "./protocol/bus.ts";
export type { LocalBusEnvelope } from "./protocol/types.ts";

import { InMemoryLocalBus } from "./protocol/bus.ts";
import type { LocalBus } from "./protocol/bus.ts";

/** Runtime instance returned by createRuntime(). */
export interface RuntimeInstance {
  readonly bus: LocalBus;
  readonly version: string;
}

/** Create a new runtime instance with an in-memory bus. */
export function createRuntime(): RuntimeInstance {
  return {
    bus: new InMemoryLocalBus(),
    version: VERSION,
  };
}
