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

// Exports from protocol and audit subsystems
import type { AuditSink } from "./audit/sink";
import { InMemoryLocalBus } from "./protocol/bus";

type RuntimeOptions = {
  auditSink?: AuditSink;
};

export function createRuntime(options: RuntimeOptions = {}) {
  const bus = new InMemoryLocalBus({ auditSink: options.auditSink });
  return {
    bus,
    getState: () => bus.getState(),
    getEvents: () => bus.getEvents(),
    getAuditRecords: () => bus.getAuditRecords()
  };
}
