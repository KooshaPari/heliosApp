// FR-004, FR-010: SLO violation detection, rate-limited event emission, and periodic check loop.

import type { MetricsRegistry } from "./metrics.js";
import { computePercentiles } from "./percentiles.js";
import type { SLODefinition, SLOViolationEvent } from "./types.js";

/** Function signature for publishing events to the bus. */
export type BusPublishFn = (topic: string, payload: unknown) => void | Promise<void>;

/**
 * Monitors registered metrics against SLO definitions, emitting rate-limited
 * violation events when thresholds are breached.
 */
class SloMonitor {
  private readonly registry: MetricsRegistry;
  private readonly definitions: SLODefinition[];
  private readonly busPublish: BusPublishFn | undefined;

  /** Map<metric:percentile, lastEmissionTimestamp> for rate limiting. */
  private readonly rateLimitMap = new Map<string, number>();
  private rateLimitWindowMs = 10_000;

  private intervalHandle: ReturnType<typeof setInterval> | undefined = undefined;
  private running = false;
  private publishFailureCount = 0;
  private slowCheckCount = 0;

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
    const now = Date.now();
    const violations: SLOViolationEvent[] = [];

    for (const def of this.definitions) {
      const violation = this.evaluateDefinition(def, now);
      if (violation !== undefined) {
        violations.push(violation);
      }
    }

    this.publishViolations(violations);
    return violations;
  }

  private evaluateDefinition(def: SLODefinition, now: number): SLOViolationEvent | undefined {
    const metric = this.registry.getMetric(def.metric);
    if (metric === undefined) {
      return undefined;
    }

    const values = metric.buffer.getValues();
    if (values.length === 0) {
      return undefined;
    }

    const stats = computePercentiles(values);
    if (stats === undefined) {
      return undefined;
    }

    const actual = stats[def.percentile];
    if (actual <= def.threshold) {
      return undefined;
    }

    if (!this.canEmit(def.metric, def.percentile, now)) {
      return undefined;
    }

    return {
      metric: def.metric,
      percentile: def.percentile,
      threshold: def.threshold,
      actual,
      timestamp: now,
    };
  }

  private canEmit(metric: string, percentile: string, now: number): boolean {
    const key = `${metric}:${percentile}`;
    const lastEmission = this.rateLimitMap.get(key);
    if (lastEmission !== undefined && now - lastEmission < this.rateLimitWindowMs) {
      return false;
    }
    this.rateLimitMap.set(key, now);
    return true;
  }

  private publishViolations(violations: SLOViolationEvent[]): void {
    if (this.busPublish === undefined) {
      return;
    }
    for (const event of violations) {
      try {
        const result = this.busPublish("perf.slo_violation", event);
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch((error: unknown) => {
            this.onPublishFailure(error);
          });
        }
      } catch (error: unknown) {
        this.onPublishFailure(error);
      }
    }
  }

  private onPublishFailure(_error: unknown): void {
    this.publishFailureCount++;
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
  start(intervalMs = 5000): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
    }
    this.running = true;
    this.intervalHandle = setInterval(() => {
      if (!this.running) {
        return;
      }
      const start = performance.now();
      this.checkAll();
      const elapsed = performance.now() - start;
      if (elapsed > 5) {
        this.slowCheckCount++;
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

// biome-ignore lint/style/useNamingConvention: keep backward-compatible public API name.
export { SloMonitor as SLOMonitor };
