import type { LocalBusEnvelope } from "./types.js";
import type {
  AuditRecord,
  BusState,
  MetricAccumulatorEntry,
  MetricSample,
  RendererEngine,
} from "./bus_in_memory_types.js";

export type InMemoryBusContext = {
  auditLog: AuditRecord[];
  eventLog: LocalBusEnvelope[];
  lifecycleProgress: Map<string, Set<string>>;
  metricsAccumulator: Map<string, MetricAccumulatorEntry>;
  metricSamples: MetricSample[];
  rendererEngineRef: { current: RendererEngine };
  stateRef: { current: BusState };
};
