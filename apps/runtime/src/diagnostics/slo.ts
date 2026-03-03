// FR-003: SLO threshold definitions from the constitution.

import type { SLODefinition, PercentileBucket } from "./types.js";

/**
 * Machine-readable SLO definitions matching the constitution targets.
 * Frozen to prevent runtime mutation.
 */
export const SLO_DEFINITIONS: readonly SLODefinition[] = Object.freeze([
  { metric: "input-to-echo", percentile: "p50", threshold: 30, unit: "ms" },
  { metric: "input-to-echo", percentile: "p95", threshold: 60, unit: "ms" },
  { metric: "input-to-render", percentile: "p50", threshold: 60, unit: "ms" },
  { metric: "input-to-render", percentile: "p95", threshold: 150, unit: "ms" },
  { metric: "fps", percentile: "p50", threshold: 60, unit: "fps" },
  { metric: "memory", percentile: "p95", threshold: 500, unit: "MB" },
  { metric: "startup-to-interactive", percentile: "p95", threshold: 2000, unit: "ms" },
]);

/** Return all SLO definitions for a given metric name. */
export function getSLOsForMetric(metric: string): SLODefinition[] {
  return SLO_DEFINITIONS.filter((slo) => slo.metric === metric);
}

/**
 * Check whether a percentile bucket satisfies an SLO.
 *
 * - For FPS: violation is when actual < threshold (lower is worse).
 * - For memory: compares the p95 value against threshold.
 * - For latency metrics: violation is when actual > threshold (higher is worse).
 * - Zero-count bucket always passes (no data = no violation).
 */
export function checkSLO(
  slo: SLODefinition,
  bucket: PercentileBucket,
): { passed: boolean; actual: number } {
  if (bucket.count === 0) {
    return { passed: true, actual: 0 };
  }

  const actual = bucket[slo.percentile];

  if (slo.unit === "fps") {
    // FPS: lower actual is worse — violation when actual < threshold.
    return { passed: actual >= slo.threshold, actual };
  }

  // Latency / memory: higher actual is worse — violation when actual > threshold.
  return { passed: actual <= slo.threshold, actual };
}
