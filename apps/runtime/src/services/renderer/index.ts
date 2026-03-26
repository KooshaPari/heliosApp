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
  RendererState,
  RenderSurface,
} from "../../renderer/adapter.js";

export type {
  CapabilityDiff,
  CapabilityDiff as CapabilityDiffEntry,
  RendererCapabilities,
} from "../../renderer/capabilities.js";
export { compareCapabilities, queryCapabilities } from "../../renderer/capabilities.js";
export type {
  HotSwapResult,
  TerminalContext,
} from "../../renderer/hot_swap.js";
export {
  executeHotSwap,
  HotSwapCapabilityError,
  HotSwapError,
} from "../../renderer/hot_swap.js";

export type { RegistrationMeta } from "../../renderer/registry.js";
export {
  DuplicateRendererError,
  RendererNotFoundError,
  RendererRegistry,
} from "../../renderer/registry.js";
export type {
  RestartRestoreResult,
  ZmxCheckpoint,
} from "../../renderer/restart_restore.js";
export {
  executeRestartWithRestore,
  RestartRestoreError,
} from "../../renderer/restart_restore.js";
export type {
  RollbackResult,
  RollbackTerminalStatus,
} from "../../renderer/rollback.js";
export {
  executeRollback,
  RollbackError,
} from "../../renderer/rollback.js";
export type {
  RendererEvent,
  TransitionRecord,
} from "../../renderer/state_machine.js";
export {
  InvalidRendererTransitionError,
  RendererStateMachine,
  transition,
} from "../../renderer/state_machine.js";
export type {
  BufferOverflowEvent,
  StreamBinding,
  StreamBindingEventBus,
} from "../../renderer/stream_binding.js";
export {
  StreamBindingManager,
  SwitchBuffer,
} from "../../renderer/stream_binding.js";
export type { SwitchContext } from "../../renderer/switch.js";
export {
  SwitchSameRendererError,
  SwitchTimeoutError,
  switchRenderer,
} from "../../renderer/switch.js";
export type {
  SwitchTransaction,
  SwitchTransactionRequest,
  SwitchTransactionState,
} from "../../renderer/switch_transaction.js";
export {
  ConcurrentSwitchError,
  createSwitchOrchestrator,
  InvalidTransitionError,
  SwitchTransactionOrchestrator,
} from "../../renderer/switch_transaction.js";
