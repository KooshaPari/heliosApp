export {
  MuxEventType,
  type MuxEventTypeValue,
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
  type MuxEvent,
  type EventBus,
} from "./events/types.js";
export {
  MuxEventEmitter,
  generateCorrelationId,
} from "./events/emitter.js";
