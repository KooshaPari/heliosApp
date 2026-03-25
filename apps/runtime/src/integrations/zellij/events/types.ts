import type { PaneDimensions } from "../types.js";

export const MuxEventType = {
  SESSION_CREATED: "mux.session.created",
  SESSION_REATTACHED: "mux.session.reattached",
  SESSION_TERMINATED: "mux.session.terminated",
  PANE_ADDED: "mux.pane.added",
  PANE_CLOSED: "mux.pane.closed",
  PANE_RESIZED: "mux.pane.resized",
  PANE_PTY_BOUND: "mux.pane.pty_bound",
  PANE_DIMENSION_REJECTED: "mux.pane.dimension_rejected",
  TAB_CREATED: "mux.tab.created",
  TAB_CLOSED: "mux.tab.closed",
  TAB_SWITCHED: "mux.tab.switched",
} as const;

export type MuxEventTypeValue =
  (typeof MuxEventType)[keyof typeof MuxEventType];

export interface MuxEventBase {
  type: MuxEventTypeValue;
  sessionName: string;
  laneId: string;
  timestamp: number;
  correlationId: string;
}

export interface SessionCreatedEvent extends MuxEventBase {
  type: typeof MuxEventType.SESSION_CREATED;
}

export interface SessionReattachedEvent extends MuxEventBase {
  type: typeof MuxEventType.SESSION_REATTACHED;
  recoveredPaneCount: number;
  recoveredTabCount: number;
}

export interface SessionTerminatedEvent extends MuxEventBase {
  type: typeof MuxEventType.SESSION_TERMINATED;
}

export interface PaneAddedEvent extends MuxEventBase {
  type: typeof MuxEventType.PANE_ADDED;
  paneId: number;
  dimensions: PaneDimensions;
}

export interface PaneClosedEvent extends MuxEventBase {
  type: typeof MuxEventType.PANE_CLOSED;
  paneId: number;
}

export interface PaneResizedEvent extends MuxEventBase {
  type: typeof MuxEventType.PANE_RESIZED;
  paneId: number;
  oldDimensions: PaneDimensions;
  newDimensions: PaneDimensions;
}

export interface PanePtyBoundEvent extends MuxEventBase {
  type: typeof MuxEventType.PANE_PTY_BOUND;
  paneId: number;
  ptyId: string;
}

export interface PaneDimensionRejectedEvent extends MuxEventBase {
  type: typeof MuxEventType.PANE_DIMENSION_REJECTED;
  paneId: number;
  requestedDimensions: PaneDimensions;
  minDimensions: PaneDimensions;
}

export interface TabCreatedEvent extends MuxEventBase {
  type: typeof MuxEventType.TAB_CREATED;
  tabId: number;
  tabName: string;
}

export interface TabClosedEvent extends MuxEventBase {
  type: typeof MuxEventType.TAB_CLOSED;
  tabId: number;
}

export interface TabSwitchedEvent extends MuxEventBase {
  type: typeof MuxEventType.TAB_SWITCHED;
  fromTabId: number;
  toTabId: number;
}

export type MuxEvent =
  | SessionCreatedEvent
  | SessionReattachedEvent
  | SessionTerminatedEvent
  | PaneAddedEvent
  | PaneClosedEvent
  | PaneResizedEvent
  | PanePtyBoundEvent
  | PaneDimensionRejectedEvent
  | TabCreatedEvent
  | TabClosedEvent
  | TabSwitchedEvent;

export interface EventBus {
  publish(event: MuxEvent): Promise<void>;
}
