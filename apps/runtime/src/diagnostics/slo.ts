// FR-004, FR-010: SLO violation detection, rate-limited event emission, and periodic check loop.

import type { MetricsRegistry } from "./metrics.js";
import { computePercentiles } from "./percentiles.js";
import type { PercentileBucket, SLODefinition, SLOViolationEvent } from "./types.js";

/** Function signature for publishing events to the bus. */
export type BusPublishFn = (topic: string, payload: unknown) => void | Promise<void>;

/** Default SLOs used by diagnostics checks and tests. */
export const SLO_DEFINITIONS: readonly SLODefinition[] = Object.freeze([
  { metric: "input-to-echo", percentile: "p50", threshold: 30, unit: "ms" },
  { metric: "input-to-echo", percentile: "p95", threshold: 80, unit: "ms" },
  { metric: "tool-exec", percentile: "p95", threshold: 250, unit: "ms" },
  { metric: "tool-exec", percentile: "p99", threshold: 500, unit: "ms" },
  { metric: "bus-roundtrip", percentile: "p95", threshold: 20, unit: "ms" },
  { metric: "memory", percentile: "p95", threshold: 500, unit: "MB" },
  { metric: "fps", percentile: "p50", threshold: 60, unit: "fps" },
]);

export interface SLOCheckResult {
  readonly passed: boolean;
  readonly actual: number;
}

/** Return all configured SLOs for a metric name. */
export function getSLOsForMetric(metric: string): SLODefinition[] {
  return SLO_DEFINITIONS.filter(slo => slo.metric === metric);
}

/**
 * Evaluate a single SLO against percentile stats.
 * FPS is treated as a lower-bound objective, all others are upper-bound.
 */
export function checkSLO(slo: SLODefinition, bucket: PercentileBucket): SLOCheckResult {
  if (bucket.count === 0) {
    return { passed: true, actual: 0 };
  }

  const actual = bucket[slo.percentile];
  const passed = slo.unit === "fps" ? actual >= slo.threshold : actual <= slo.threshold;
  return { passed, actual };
}

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
            (result as Promise<void>).catch(err => {
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
