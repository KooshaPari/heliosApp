// Export watchdog modules

export { OrphanWatchdog, type WatchdogConfig } from './orphan_watchdog';
export { CheckpointManager, type WatchdogCheckpoint } from './checkpoint';
export {
  ResourceClassifier,
  type OrphanedResource,
  type ClassifiedOrphan,
  type ResourceType,
  type RiskLevel,
} from './resource_classifier';
export { WorktreeDetector } from './worktree_detector';
export { ZellijDetector, type SessionRegistry } from './zellij_detector';
export { PtyDetector, type TerminalRegistry } from './pty_detector';
export {
  RemediationEngine,
  type RemediationSuggestion,
  type CleanupResult,
} from './remediation';
