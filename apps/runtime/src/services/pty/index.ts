/**
 * PTY Service - Pseudo-Terminal Management
 *
 * Provides unified access to PTY lifecycle management including:
 * - Process spawning and termination
 * - Input/output handling
 * - Signal management
 * - Registry and state tracking
 * - Idle monitoring
 *
 * @module services/pty
 */

export {
  type BufferStats,
  OutputBuffer,
  type OutputBufferConfig,
  RingBuffer,
  type RingWriteResult,
} from "../../pty/buffers.js";
export {
  type BusPublisher,
  emitPtyEvent,
  InMemoryBusPublisher,
  NoOpBusPublisher,
  type PtyBusEvent,
  type PtyEventCorrelation,
  type PtyEventTopic,
} from "../../pty/events.js";
export { IdleMonitor, type IdleMonitorConfig } from "../../pty/idle_monitor.js";
// Main facade for PTY service
export { PtyManager } from "../../pty/index.js";
export {
  InvalidStateError,
  type ProcessMap,
  type WriteResult,
  writeInput,
} from "../../pty/io.js";
export {
  DuplicatePtyError,
  type PtyDimensions,
  type PtyRecord,
  PtyRegistry,
  type ReconciliationSummary,
  RegistryCapacityError,
} from "../../pty/registry.js";
export {
  InvalidDimensionsError,
  resize,
  type SignalEnvelope,
  SignalHistory,
  type SignalHistoryMap,
  sendSighup,
  type TerminateOptions,
  terminate,
} from "../../pty/signals.js";
export { type SpawnOptions, type SpawnResult, spawnPty } from "../../pty/spawn.js";
// Re-export everything from the main PTY module
export {
  InvalidTransitionError,
  type PtyEvent,
  PtyLifecycle,
  type PtyState,
  type TransitionRecord,
  transition,
} from "../../pty/state_machine.js";
