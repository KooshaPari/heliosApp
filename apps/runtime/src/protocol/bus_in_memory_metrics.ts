import type { InMemoryBusContext } from "./bus_in_memory_context.js";
import type {
  MetricAccumulatorEntry,
  MetricSummary,
  MetricsReport,
} from "./bus_in_memory_types.js";
import type { LocalBusEnvelope } from "./types.js";

export function getMetricsReport(context: InMemoryBusContext): MetricsReport {
  const summaries: MetricSummary[] = [];
  for (const [metric, data] of context.metricsAccumulator) {
    const summary: MetricSummary = {
      metric,
      count: data.count,
      ...(data.latest !== undefined ? { latest: data.latest } : {}),
    };
    if (data.values.length > 0) {
      const sorted = [...data.values].sort((a, b) => a - b);
      const p95Idx = Math.ceil(0.95 * sorted.length) - 1;
      const p99Idx = Math.ceil(0.99 * sorted.length) - 1;
      summary.p95 = sorted[Math.max(0, p95Idx)];
      summary.p99 = sorted[Math.max(0, p99Idx)];
      summary.min = sorted[0];
      summary.max = sorted[sorted.length - 1];
    }
    summaries.push(summary);
  }
  return { summaries, samples: [...context.metricSamples] };
}

export function getSequence(context: InMemoryBusContext): number {
  return context.eventLog.filter(event => event.type === "event").length;
}

export function appendAcceptedEvent(
  context: InMemoryBusContext,
  event: LocalBusEnvelope,
  recordedAt = new Date().toISOString()
): void {
  context.auditLog.push({ envelope: event, outcome: "accepted", recorded_at: recordedAt });
  context.eventLog.push(event);
}

export function recordMetric(
  context: InMemoryBusContext,
  metric: string,
  value?: number,
  tags?: Record<string, string>
): void {
  const existing = context.metricsAccumulator.get(metric) ?? { count: 0, values: [] };
  const latestValue = value !== undefined ? value : existing.latest;
  const updated: MetricAccumulatorEntry = {
    count: existing.count + 1,
    ...(latestValue !== undefined ? { latest: latestValue } : {}),
    values: existing.values,
  };
  if (value !== undefined) {
    updated.values.push(value);
  }
  context.metricsAccumulator.set(metric, updated);
  if (value !== undefined) {
    context.metricSamples.push({ metric, value, ...(tags !== undefined ? { tags } : {}) });
  }
}

export function emitMetricEvent(context: InMemoryBusContext, metric: string, value?: number): void {
  const event: LocalBusEnvelope = {
    id: `metric-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "event",
    ts: new Date().toISOString(),
    topic: "diagnostics.metric",
    payload: { metric, value },
    sequence: getSequence(context) + 1,
  };
  appendAcceptedEvent(context, event);
}
