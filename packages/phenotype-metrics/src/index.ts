/**
 * MetricsRegistry
 *
 * Central registry for all application metrics with support for:
 * - Counter, Gauge, Histogram, and Latency metric types
 * - Ring buffer storage for efficient memory usage
 * - Percentile calculations
 * - Sliding window aggregations
 * - JSON export for monitoring systems
 *
 * @example
 * ```typescript
 * const registry = new MetricsRegistry();
 *
 * // Register a latency metric
 * registry.register({
 *   name: "http.request.duration",
 *   type: "latency",
 *   unit: "ms",
 *   description: "HTTP request duration",
 *   bufferSize: 1000,
 * });
 *
 * // Record a measurement
 * registry.record("http.request.duration", 42.5);
 *
 * // Get statistics
 * const stats = registry.get("http.request.duration");
 * console.log(stats.mean); // ~42.5
 * ```
 */

import { aggregate } from "./aggregator.js";
import { RingBuffer } from "./ring-buffer.js";

/**
 * Metric type enumeration.
 */
export type MetricType = "counter" | "gauge" | "histogram" | "latency";

/**
 * Unit of measurement for metrics.
 */
export type MetricUnit = "bytes" | "ms" | "percent" | "requests" | "errors" | "count" | string;

/**
 * Configuration for registering a new metric.
 */
export interface MetricConfig {
  /** Unique metric name (e.g., "http.request.duration") */
  name: string;
  /** Type of metric */
  type: MetricType;
  /** Unit of measurement */
  unit: MetricUnit;
  /** Human-readable description */
  description: string;
  /** Size of the ring buffer (default: 1000) */
  bufferSize?: number;
  /** Labels/tags for the metric */
  labels?: Record<string, string>;
  /** Minimum value threshold */
  min?: number;
  /** Maximum value threshold */
  max?: number;
}

/**
 * Registered metric with its buffer.
 */
export interface Metric {
  config: MetricConfig;
  buffer: RingBuffer<number>;
  lastUpdated: number;
}

/**
 * Result of getting metric statistics.
 */
export interface MetricStats {
  name: string;
  type: MetricType;
  unit: MetricUnit;
  count: number;
  value: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
  lastUpdated: number;
}

/**
 * Snapshot of all metrics for export.
 */
export interface MetricsSnapshot {
  timestamp: number;
  metrics: MetricStats[];
  system: SystemMetrics;
}

/**
 * System-level metrics.
 */
export interface SystemMetrics {
  memoryUsageMB: number;
  cpuUsage: number;
  uptime: number;
}

/**
 * Default buffer size if not specified.
 */
const DEFAULT_BUFFER_SIZE = 1000;

/**
 * Global registry instance.
 */
let globalRegistry: MetricsRegistry | null = null;

/**
 * MetricsRegistry - Central registry for application metrics.
 *
 * Thread-safe for concurrent access patterns common in Node.js/Bun.
 */
export class MetricsRegistry {
  private readonly metrics: Map<string, Metric> = new Map();
  private readonly lock: Map<string, boolean> = new Map();

  /**
   * Get the global metrics registry instance.
   * Creates one if it doesn't exist.
   */
  static getInstance(): MetricsRegistry {
    if (!globalRegistry) {
      globalRegistry = new MetricsRegistry();
    }
    return globalRegistry;
  }

  /**
   * Reset the global registry (useful for testing).
   */
  static resetInstance(): void {
    globalRegistry = null;
  }

  /**
   * Register a new metric.
   *
   * @param config - Metric configuration
   * @throws Error if metric already exists
   */
  register(config: MetricConfig): void {
    const { name, bufferSize = DEFAULT_BUFFER_SIZE } = config;

    if (this.metrics.has(name)) {
      throw new Error(`Metric "${name}" already registered`);
    }

    const metric: Metric = {
      config,
      buffer: new RingBuffer<number>(bufferSize),
      lastUpdated: Date.now(),
    };

    this.metrics.set(name, metric);
  }

  /**
   * Unregister a metric.
   *
   * @param name - Metric name to remove
   * @returns true if metric was removed, false if not found
   */
  unregister(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Check if a metric is registered.
   */
  has(name: string): boolean {
    return this.metrics.has(name);
  }

  /**
   * Get a metric's current statistics.
   *
   * @param name - Metric name
   * @returns MetricStats or null if not found
   */
  get(name: string): MetricStats | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      return null;
    }

    const samples = metric.buffer.toArray();
    if (samples.length === 0) {
      return {
        name,
        type: metric.config.type,
        unit: metric.config.unit,
        count: 0,
        value: 0,
        sum: 0,
        mean: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        lastUpdated: metric.lastUpdated,
      };
    }

    const stats = aggregate(samples);

    // For counters, the current value is the sum
    // For gauges, the current value is the last reading
    // For histograms/latency, we report the mean
    let value: number;
    switch (metric.config.type) {
      case "counter":
        value = stats.sum;
        break;
      case "gauge":
        value = samples[samples.length - 1];
        break;
      default:
        value = stats.mean;
    }

    return {
      name,
      type: metric.config.type,
      unit: metric.config.unit,
      count: stats.count,
      value,
      sum: stats.sum,
      mean: stats.mean,
      min: stats.min,
      max: stats.max,
      p50: stats.p50 ?? 0,
      p90: stats.p90 ?? 0,
      p95: stats.p95 ?? 0,
      p99: stats.p99 ?? 0,
      stdDev: stats.stdDev ?? 0,
      lastUpdated: metric.lastUpdated,
    };
  }

  /**
   * Record a value for a metric.
   *
   * @param name - Metric name
   * @param value - Value to record
   * @param timestamp - Optional timestamp (defaults to now)
   */
  record(name: string, value: number, timestamp?: number): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      // Auto-register with default settings
      this.register({
        name,
        type: "gauge",
        unit: "count",
        description: `Auto-registered metric: ${name}`,
      });
      const newMetric = this.metrics.get(name)!;
      newMetric.buffer.push(value);
      newMetric.lastUpdated = timestamp ?? Date.now();
      return;
    }

    // Apply min/max bounds if configured
    let boundedValue = value;
    if (metric.config.min !== undefined && boundedValue < metric.config.min) {
      boundedValue = metric.config.min;
    }
    if (metric.config.max !== undefined && boundedValue > metric.config.max) {
      boundedValue = metric.config.max;
    }

    metric.buffer.push(boundedValue);
    metric.lastUpdated = timestamp ?? Date.now();
  }

  /**
   * Increment a counter metric.
   *
   * @param name - Counter metric name
   * @param amount - Amount to increment (default: 1)
   */
  increment(name: string, amount = 1): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.buffer.push(amount);
      metric.lastUpdated = Date.now();
    } else {
      this.register({
        name,
        type: "counter",
        unit: "count",
        description: `Counter: ${name}`,
      });
      this.metrics.get(name)?.buffer.push(amount);
    }
  }

  /**
   * Decrement a counter metric.
   *
   * @param name - Counter metric name
   * @param amount - Amount to decrement (default: 1)
   */
  decrement(name: string, amount = 1): void {
    this.increment(name, -amount);
  }

  /**
   * Set a gauge metric to a specific value.
   *
   * @param name - Gauge metric name
   * @param value - Value to set
   */
  setGauge(name: string, value: number): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.register({
        name,
        type: "gauge",
        unit: "count",
        description: `Gauge: ${name}`,
      });
    }
    this.record(name, value);
  }

  /**
   * Record latency for a metric (convenience method).
   * Automatically calculates the duration from start to now.
   *
   * @param name - Latency metric name
   * @param startTime - Start time (from performance.now())
   */
  recordLatency(name: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.record(name, duration);
  }

  /**
   * Get all registered metric names.
   */
  listNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get all metric configurations.
   */
  listMetrics(): MetricConfig[] {
    return Array.from(this.metrics.values()).map(m => m.config);
  }

  /**
   * Get statistics for all metrics.
   */
  getAll(): Map<string, MetricStats> {
    const result = new Map<string, MetricStats>();
    for (const [name] of this.metrics) {
      const stats = this.get(name);
      if (stats) {
        result.set(name, stats);
      }
    }
    return result;
  }

  /**
   * Take a snapshot of all metrics for export.
   *
   * @param includeSystem - Include system-level metrics (default: true)
   */
  snapshot(includeSystem = true): MetricsSnapshot {
    const metrics: MetricStats[] = [];
    for (const [, stats] of this.getAll()) {
      metrics.push(stats);
    }

    const system: SystemMetrics = {
      memoryUsageMB: 0,
      cpuUsage: 0,
      uptime: 0,
    };

    if (includeSystem) {
      try {
        const memUsage = process.memoryUsage();
        system.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        system.uptime = process.uptime();
        // CPU usage would require platform-specific implementation
      } catch {
        // Ignore errors in non-Node environments
      }
    }

    return {
      timestamp: Date.now(),
      metrics,
      system,
    };
  }

  /**
   * Export metrics in Prometheus format.
   *
   * @param prefix - Prefix for metric names (default: "helios_")
   */
  toPrometheus(prefix = "helios_"): string {
    const lines: string[] = [];

    for (const [name, stats] of this.getAll()) {
      const fullName = `${prefix}${name.replace(/\./g, "_")}`;
      const labels = Object.entries(stats)
        .filter(([k]) => !["name", "type", "unit", "lastUpdated"].includes(k))
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");

      // Add HELP and TYPE comments
      lines.push(`# HELP ${fullName} ${stats.type} metric`);
      lines.push(`# TYPE ${fullName} ${stats.type}`);

      // Export each statistic as a separate metric
      lines.push(`${fullName}_count${labels ? `{${labels}}` : ""} ${stats.count}`);
      lines.push(`${fullName}_sum${labels ? `{${labels}}` : ""} ${stats.sum}`);
      lines.push(`${fullName}_mean${labels ? `{${labels}}` : ""} ${stats.mean}`);
      lines.push(`${fullName}_min${labels ? `{${labels}}` : ""} ${stats.min}`);
      lines.push(`${fullName}_max${labels ? `{${labels}}` : ""} ${stats.max}`);
      lines.push(`${fullName}_p50${labels ? `{${labels}}` : ""} ${stats.p50}`);
      lines.push(`${fullName}_p90${labels ? `{${labels}}` : ""} ${stats.p90}`);
      lines.push(`${fullName}_p95${labels ? `{${labels}}` : ""} ${stats.p95}`);
      lines.push(`${fullName}_p99${labels ? `{${labels}}` : ""} ${stats.p99}`);
      lines.push(`${fullName}_stddev${labels ? `{${labels}}` : ""} ${stats.stdDev}`);
    }

    return lines.join("\n");
  }

  /**
   * Export metrics in JSON format.
   */
  toJSON(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  /**
   * Clear all metrics (useful for testing).
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get memory usage statistics for the registry.
   */
  getMemoryUsage(): {
    metricCount: number;
    totalBufferSlots: number;
    estimatedBytes: number;
  } {
    let totalBufferSlots = 0;
    for (const metric of this.metrics.values()) {
      totalBufferSlots += metric.buffer.capacity;
    }

    // Rough estimate: 8 bytes per float64 slot + overhead
    const estimatedBytes = totalBufferSlots * 8 + this.metrics.size * 200;

    return {
      metricCount: this.metrics.size,
      totalBufferSlots,
      estimatedBytes,
    };
  }
}

// Export convenience functions for global registry
export const registerMetric = (config: MetricConfig) =>
  MetricsRegistry.getInstance().register(config);

export const recordMetric = (name: string, value: number, timestamp?: number) =>
  MetricsRegistry.getInstance().record(name, value, timestamp);

export const getMetric = (name: string) => MetricsRegistry.getInstance().get(name);

export const getAllMetrics = () => MetricsRegistry.getInstance().getAll();

export const metricsSnapshot = (includeSystem?: boolean) =>
  MetricsRegistry.getInstance().snapshot(includeSystem);

export const metricsToPrometheus = (prefix?: string) =>
  MetricsRegistry.getInstance().toPrometheus(prefix);

export const metricsToJson = () => MetricsRegistry.getInstance().toJSON();
