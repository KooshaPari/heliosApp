// Re-export all bus module types and implementations
export type {
  LocalBus,
  AuditRecord,
  MetricSample,
  MetricSummary,
  MetricsReport,
  BusState,
  CommandBusOptions,
  CommandEnvelope,
  EventEnvelope,
  ResponseEnvelope,
  LocalBusEnvelopeWithSequence,
} from './types';

export { InMemoryLocalBus, CommandBusImpl, createBus } from './emitter';

export {
  LIFECYCLE_SEQUENCES,
  TERMINAL_TOPICS,
  START_TOPICS,
  isTerminalTopic,
  isStartTopic,
  resolveExpectedStartTopic,
  publishLifecycleEvent,
} from './lifecycle';

export { MetricsRecorder } from './metrics';

export { isCommandEnvelope, isEventEnvelope, hasTopLevelDataField } from './validation';
