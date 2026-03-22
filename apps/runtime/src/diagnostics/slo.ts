// FR-004, FR-010: SLO violation detection, rate-limited event emission, and periodic check loop.

import type { SLODefinition, SLOViolationEvent, PercentileBucket } from "./types.js";
import type { MetricsRegistry } from "./metrics.js";
import { computePercentiles } from "./percentiles.js";

// ---------------------------------------------------------------------------
// Constitution SLO definitions (single source of truth)
// ---------------------------------------------------------------------------

export const SLO_DEFINITIONS: readonly SLODefinition[] = Object.freeze([
  { metric: "input-to-echo", percentile: "p50", threshold: 30, unit: "ms" },
  { metric: "input-to-echo", percentile: "p99", threshold: 100, unit: "ms" },
  { metric: "render-frame", percentile: "p50", threshold: 16, unit: "ms" },
  { metric: "render-frame", percentile: "p99", threshold: 33, unit: "ms" },
  { metric: "fps", percentile: "p50", threshold: 60, unit: "fps" },
  { metric: "memory", percentile: "p95", threshold: 500, unit: "MB" },
  { metric: "startup", percentile: "p50", threshold: 2000, unit: "ms" },
]);

/** Get SLO definitions for a specific metric. */
export function getSLOsForMetric(metric: string): SLODefinition[] {
  return SLO_DEFINITIONS.filter((d) => d.metric === metric);
}

/** Check result from evaluating an SLO against a percentile bucket. */
export interface SLOCheckResult {
  passed: boolean;
  actual: number;
  threshold: number;
  metric: string;
  percentile: string;
}

/** Check a single SLO against a percentile bucket. */
export function checkSLO(slo: SLODefinition, bucket: PercentileBucket): SLOCheckResult {
  const actual = bucket[slo.percentile];

  if (bucket.count === 0) {
    return { passed: true, actual: 0, threshold: slo.threshold, metric: slo.metric, percentile: slo.percentile };
  }

  // For fps, higher is better (pass if >= threshold)
  // For latency/memory, lower is better (pass if <= threshold)
  const passed = slo.unit === "fps" ? actual >= slo.threshold : actual <= slo.threshold;

  return { passed, actual, threshold: slo.threshold, metric: slo.metric, percentile: slo.percentile };
}

/** Function signature for publishing events to the bus. */
export type BusPublishFn = (topic: string, payload: unknown) => void | Promise<void>;

/**
 * Monitors registered metrics against SLO definitions, emitting rate-limited
 * violation events when thresholds are breached.
 */
export class SLOMonitor {
  private readonly registry: MetricsRegistry;
  private readonly definitions: SLODefinition[];
  private readonly busPublish: BusPublishFn | undefined;

  /** Map<metric:percentile, lastEmissionTimestamp> for rate limiting. */
  private readonly rateLimitMap = new Map<string, number>();
  private rateLimitWindowMs = 10_000;

  private intervalHandle: ReturnType<typeof setInterval> | undefined = undefined;
  private running = false;

  constructor(registry: MetricsRegistry, definitions: SLODefinition[], busPublish?: BusPublishFn) {
    this.registry = registry;
    this.definitions = definitions;
    this.busPublish = busPublish;
  }

  /**
   * Check all SLO definitions against current metric values.
   * Returns violation events (already filtered by rate limiter).
   */
  checkAll(): SLOViolationEvent[] {
    const violations: SLOViolationEvent[] = [];
    const now = Date.now();

    for (const def of this.definitions) {
      const metric = this.registry.getMetric(def.metric);
      if (metric === undefined) {
        // No data recorded yet — no violation.
        continue;
      }

      const values = metric.buffer.getValues();
      if (values.length === 0) {
        continue;
      }

      const stats = computePercentiles(values);
      if (stats === undefined) {
        continue;
      }

      const actual = stats[def.percentile];
      if (actual <= def.threshold) {
        // Within SLO — no violation.
        continue;
      }

      // Rate limit check.
      const key = `${def.metric}:${def.percentile}`;
      const lastEmission = this.rateLimitMap.get(key);
      if (lastEmission !== undefined && now - lastEmission < this.rateLimitWindowMs) {
        continue;
      }

      const event: SLOViolationEvent = {
        metric: def.metric,
        percentile: def.percentile,
        threshold: def.threshold,
        actual,
        timestamp: now,
      };

      this.rateLimitMap.set(key, now);
      violations.push(event);
    }

    // Publish to bus or log.
    for (const event of violations) {
      if (this.busPublish !== undefined) {
        try {
          const result = this.busPublish("perf.slo_violation", event);
          // If async, catch errors without blocking.
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch((err) => {
              console.error("[slo] Bus publish error:", err);
            });
          }
        } catch (err) {
          console.error("[slo] Bus publish error:", err);
        }
      } else {
        console.log("[slo] Violation:", event);
      }
    }

    return violations;
  }

  /** Reset the rate limiter — useful for testing. */
  resetRateLimiter(): void {
    this.rateLimitMap.clear();
  }

  /** Override the rate limit window — useful for testing. */
  setRateLimitWindowMs(ms: number): void {
    this.rateLimitWindowMs = ms;
  }

  /**
   * Start periodic SLO checks.
   * Calling start() again clears the previous interval.
   */
  start(intervalMs: number = 5000): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
    }
    this.running = true;
    this.intervalHandle = setInterval(() => {
      if (!this.running) return;
      const t0 = performance.now();
      this.checkAll();
      const elapsed = performance.now() - t0;
      if (elapsed > 5) {
        console.warn(`[slo] checkAll took ${elapsed.toFixed(2)}ms (> 5ms budget)`);
      }
    }, intervalMs);
  }

  /** Stop the periodic check loop. */
  stop(): void {
    this.running = false;
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }
}
