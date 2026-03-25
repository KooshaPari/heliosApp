/**
 * phenotype-metrics
 *
 * High-performance metrics library with ring buffer storage,
 * percentile calculations, and Prometheus/JSON export.
 */

// Core classes
export {
  MetricsRegistry,
  registerMetric,
  recordMetric,
  getMetric,
  getAllMetrics,
  metricsSnapshot,
  metricsToPrometheus,
  metricsToJSON,
} from "./index.js";

export { RingBuffer } from "./ring-buffer.js";
export { Aggregator, aggregate, getPercentiles } from "./aggregator.js";

// Types
export type {
  MetricConfig,
  MetricType,
  MetricUnit,
  Metric,
  MetricStats,
  MetricsSnapshot,
  SystemMetrics,
} from "./index.js";

export type { AggregationResult, PercentileOptions } from "./aggregator.js";
