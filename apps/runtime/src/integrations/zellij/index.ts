export { ZellijCli } from './cli';
export { ZellijSessionManager, sessionNameForLane } from './session';
export { MuxRegistry } from './registry';
export { ZellijPaneManager } from './panes';
export { ZellijTabManager } from './tabs';
export { TopologyTracker } from './topology';
export {
  MuxEventEmitter,
  MuxEventType,
  generateCorrelationId,
  type EventBus,
  type MuxEvent,
  type MuxEventBase,
  type SessionCreatedEvent,
  type SessionReattachedEvent,
  type SessionTerminatedEvent,
  type PaneAddedEvent,
  type PaneClosedEvent,
  type PaneResizedEvent,
  type PanePtyBoundEvent,
  type PaneDimensionRejectedEvent,
  type TabCreatedEvent,
  type TabClosedEvent,
  type TabSwitchedEvent,
} from './events';
export { reconcile, type ReconciliationResult } from './reconciliation';
export type {
  ZellijSession,
  SessionOptions,
  MuxSession,
  MuxBinding,
  PaneRecord,
  TabRecord,
  CliResult,
  AvailabilityResult,
  PaneDimensions,
  CreatePaneOptions,
  MinPaneDimensions,
  PaneTopology,
  TabTopology,
  LayoutTopology,
  PtyManagerInterface,
} from './types';
export {
  ZellijNotFoundError,
  ZellijVersionError,
  ZellijCliError,
  ZellijTimeoutError,
  SessionNotFoundError,
  SessionAlreadyExistsError,
  DuplicateBindingError,
  PaneTooSmallError,
  PaneNotFoundError,
  TabNotFoundError,
  PtyBindingError,
} from './errors';
