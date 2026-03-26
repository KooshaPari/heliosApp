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
// PTY Handle and Manager interfaces
// Lane Bus Event Topic
// Lane Manager options and main class
// Lane state and events
export type {
  FullReconciliationResult,
  LaneBusEventTopic,
  LaneEvent,
  LaneManagerOptions,
  LaneState,
  PtyHandle,
  PtyManager,
} from "../../lanes/index.js";
// Errors
// Lane Manager utilities
export { _resetIdCounter, LaneManager, NotImplementedError } from "../../lanes/index.js";

// Registry
export type { LaneRecord } from "../../lanes/registry.js";
export {
  DuplicateLaneError,
  LaneCapacityExceededError,
  LaneNotFoundError,
  LaneRegistry,
} from "../../lanes/registry.js";

// Sharing
export {
  attachAgent,
  detachAgent,
  forceDetachAll,
  LaneClosedError,
  SharedLaneCleanupError,
  type ShareResult,
  shareLane,
} from "../../lanes/sharing.js";

// State Machine
export {
  clearTransitionHistory,
  getTransitionHistory,
  InvalidLaneTransitionError,
  recordTransition,
  transition,
  withLaneLock,
} from "../../lanes/state_machine.js";

// Worktree
export type {
  ReconciliationResult,
  WorktreeLatencyMetrics,
  WorktreeOptions,
  WorktreeResult,
} from "../../lanes/worktree.js";
export {
  computeBranchName,
  computeWorktreePath,
  lastMetrics,
  provisionWorktree,
  reconcileOrphanedWorktrees,
  removeWorktree,
  resetMetrics,
  WorktreeCleanupError,
  WorktreeProvisionError,
} from "../../lanes/worktree.js";
