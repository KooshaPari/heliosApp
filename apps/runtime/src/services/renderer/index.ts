/**
 * Renderer Service - UI Rendering Management
 *
 * Provides unified access to renderer operations including:
 * - Renderer switching and hot-swapping
 * - Capability management and comparison
 * - Stream binding and buffering
 * - State machine transitions
 * - Rollback and recovery
 * - Restart with restore functionality
 *
 * @module services/renderer
 */

// Re-export everything from the main renderer module
export type {
  RendererAdapter,
  RendererConfig,
  RenderSurface,
  RendererState,
} from "../../renderer/adapter.js";

export type {
  RendererCapabilities,
  CapabilityDiff,
  CapabilityDiff as CapabilityDiffEntry,
} from "../../renderer/capabilities.js";
export { queryCapabilities, compareCapabilities } from "../../renderer/capabilities.js";

export type { RendererEvent, TransitionRecord } from "../../renderer/state_machine.js";
export {
  RendererStateMachine,
  InvalidRendererTransitionError,
  transition,
} from "../../renderer/state_machine.js";

export type { RegistrationMeta } from "../../renderer/registry.js";
export {
  RendererRegistry,
  DuplicateRendererError,
  RendererNotFoundError,
} from "../../renderer/registry.js";

export type { SwitchContext } from "../../renderer/switch.js";
export {
  switchRenderer,
  SwitchTimeoutError,
  SwitchSameRendererError,
} from "../../renderer/switch.js";

export type {
  StreamBinding,
  BufferOverflowEvent,
  StreamBindingEventBus,
} from "../../renderer/stream_binding.js";
export { StreamBindingManager, SwitchBuffer } from "../../renderer/stream_binding.js";

export type { HotSwapResult, TerminalContext } from "../../renderer/hot_swap.js";
export { executeHotSwap, HotSwapError, HotSwapCapabilityError } from "../../renderer/hot_swap.js";

export type { RollbackResult, RollbackTerminalStatus } from "../../renderer/rollback.js";
export { executeRollback, RollbackError } from "../../renderer/rollback.js";

export type {
  SwitchTransaction,
  SwitchTransactionRequest,
  SwitchTransactionState,
} from "../../renderer/switch_transaction.js";
export {
  SwitchTransactionOrchestrator,
  createSwitchOrchestrator,
  ConcurrentSwitchError,
  InvalidTransitionError,
} from "../../renderer/switch_transaction.js";

export type { ZmxCheckpoint, RestartRestoreResult } from "../../renderer/restart_restore.js";
export { executeRestartWithRestore, RestartRestoreError } from "../../renderer/restart_restore.js";
