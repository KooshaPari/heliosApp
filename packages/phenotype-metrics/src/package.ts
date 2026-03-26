/**
 * phenotype-metrics
 *
 * High-performance metrics library with ring buffer storage,
 * percentile calculations, and Prometheus/JSON export.
 */

export type { AggregationResult, PercentileOptions } from "./aggregator.js";
export { Aggregator, aggregate, getPercentiles } from "./aggregator.js";
// Types
export type {
  Metric,
  MetricConfig,
  MetricStats,
  MetricsSnapshot,
  MetricType,
  MetricUnit,
  SystemMetrics,
} from "./index.js";
// Core classes
export {
  getAllMetrics,
  getMetric,
  MetricsRegistry,
  metricsSnapshot,
  metricsToJson,
  metricsToPrometheus,
  recordMetric,
  registerMetric,
} from "./index.js";
export { RingBuffer } from "./ring-buffer.js";
