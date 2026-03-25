import type { LocalBusEnvelope } from "./types.js";

export type AuditRecord = {
  envelope: LocalBusEnvelope;
  outcome: "accepted" | "rejected";
  error?: string;
  recorded_at?: string;
};

export type MetricSample = {
  metric: string;
  value: number;
  tags?: Record<string, string>;
};

export type MetricAccumulatorEntry = {
  count: number;
  latest?: number;
  values: number[];
};

export type MetricSummary = {
  metric: string;
  count: number;
  latest?: number;
  p95?: number;
  p99?: number;
  min?: number;
  max?: number;
};

export type MetricsReport = {
  summaries: MetricSummary[];
  samples?: MetricSample[];
};

export type BusState = {
  session: "attached" | "detached";
  terminal?: "active" | "inactive" | "throttled";
};

export type RendererEngine = "ghostty" | "rio";
