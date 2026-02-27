// Runtime entry point — re-exports diagnostics instrumentation
export {
  type MetricType,
  type MetricDefinition,
  type Sample,
  type PercentileBucket,
  type SLODefinition,
  type SLOViolationEvent,
} from "./diagnostics/types.js";

export {
  type MonotonicClock,
  monotonicNow,
  markStart,
  markEnd,
  getMarkOverflowCount,
  createInstrumentationHooks,
} from "./diagnostics/hooks.js";

export {
  RingBuffer,
  MetricsRegistry,
} from "./diagnostics/metrics.js";
