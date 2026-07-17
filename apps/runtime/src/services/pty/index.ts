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

// Re-export everything from the main PTY module
export {
  type PtyState,
  type PtyEvent,
  type TransitionRecord,
  PtyLifecycle,
  InvalidTransitionError,
  transition,
} from "../../pty/state_machine.js";

export {
  type PtyRecord,
  type PtyDimensions,
  type ReconciliationSummary,
  PtyRegistry,
  DuplicatePtyError,
  RegistryCapacityError,
} from "../../pty/registry.js";

export { type SpawnOptions, type SpawnResult, spawnPty } from "../../pty/spawn.js";

export {
  type SignalEnvelope,
  SignalHistory,
  type SignalHistoryMap,
  InvalidDimensionsError,
  type TerminateOptions,
  resize,
  terminate,
  sendSighup,
} from "../../pty/signals.js";

export {
  type PtyEventCorrelation,
  type PtyEventTopic,
  type PtyBusEvent,
  type BusPublisher,
  NoOpBusPublisher,
  InMemoryBusPublisher,
  emitPtyEvent,
} from "../../pty/events.js";

export {
  InvalidStateError,
  type WriteResult,
  type ProcessMap,
  writeInput,
} from "../../pty/io.js";

export { IdleMonitor, type IdleMonitorConfig } from "../../pty/idle_monitor.js";

export {
  RingBuffer,
  type RingWriteResult,
  OutputBuffer,
  type OutputBufferConfig,
  type BufferStats,
} from "../../pty/buffers.js";

// Main facade for PTY service
export { PtyManager } from "../../pty/index.js";
