/**
 * Lanes Service - Lane/Workspace Orchestration
 *
 * Provides unified access to lane management including:
 * - Lane lifecycle management
 * - PTY management within lanes
 * - Lane sharing and agents
 * - Worktree provisioning and cleanup
 * - State machine transitions
 * - Event publishing
 * - Orphan reconciliation
 *
 * @module services/lanes
 */

// Full Reconciliation Result
export type { FullReconciliationResult } from "../../lanes/index.js";

// Errors
export { NotImplementedError } from "../../lanes/index.js";

// PTY Handle and Manager interfaces
export type { PtyHandle, PtyManager } from "../../lanes/index.js";

// Lane Bus Event Topic
export type { LaneBusEventTopic } from "../../lanes/index.js";

// Lane Manager utilities
export { _resetIdCounter } from "../../lanes/index.js";

// Lane Manager options and main class
export type { LaneManagerOptions } from "../../lanes/index.js";
export { LaneManager } from "../../lanes/index.js";

// Lane state and events
export type { LaneState, LaneEvent } from "../../lanes/index.js";

// Registry
export type { LaneRecord } from "../../lanes/registry.js";
export {
  DuplicateLaneError,
  LaneNotFoundError,
  LaneCapacityExceededError,
  LaneRegistry,
} from "../../lanes/registry.js";

// Sharing
export {
  LaneClosedError,
  SharedLaneCleanupError,
  type ShareResult,
  shareLane,
  attachAgent,
  detachAgent,
  forceDetachAll,
} from "../../lanes/sharing.js";

// State Machine
export {
  InvalidLaneTransitionError,
  transition,
  recordTransition,
  getTransitionHistory,
  clearTransitionHistory,
  withLaneLock,
} from "../../lanes/state_machine.js";

// Worktree
export type {
  WorktreeOptions,
  WorktreeResult,
  WorktreeLatencyMetrics,
  ReconciliationResult,
} from "../../lanes/worktree.js";
export {
  WorktreeProvisionError,
  WorktreeCleanupError,
  computeWorktreePath,
  computeBranchName,
  lastMetrics,
  resetMetrics,
  provisionWorktree,
  removeWorktree,
  reconcileOrphanedWorktrees,
} from "../../lanes/worktree.js";
