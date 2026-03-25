/**
 * PTY Lifecycle Manager public API surface.
 *
 * Re-exports PTY building blocks and the {@link PtyManager} facade.
 *
 * @module
 */

export {
  type PtyState,
  type PtyEvent,
  type TransitionRecord,
  PtyLifecycle,
  InvalidTransitionError,
  transition,
} from "./state_machine.js";

export {
  type PtyRecord,
  type PtyDimensions,
  type ReconciliationSummary,
  PtyRegistry,
  DuplicatePtyError,
  RegistryCapacityError,
} from "./registry.js";

export { type SpawnOptions, type SpawnResult, spawnPty } from "./spawn.js";

export {
  type SignalEnvelope,
  SignalHistory,
  type SignalHistoryMap,
  InvalidDimensionsError,
  type TerminateOptions,
  resize,
  terminate,
  sendSighup,
} from "./signals.js";

export {
  type PtyEventCorrelation,
  type PtyEventTopic,
  type PtyBusEvent,
  type BusPublisher,
  NoOpBusPublisher,
  InMemoryBusPublisher,
  emitPtyEvent,
} from "./events.js";

export { InvalidStateError, type WriteResult, type ProcessMap, writeInput } from "./io.js";

export { IdleMonitor, type IdleMonitorConfig } from "./idle_monitor.js";

export {
  RingBuffer,
  type RingWriteResult,
  OutputBuffer,
  type OutputBufferConfig,
  type BufferStats,
} from "./buffers.js";

export { PtyManager } from "./manager.js";
