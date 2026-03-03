/**
 * T011 - Mux event relay.
 *
 * Defines all mux event types and provides a fire-and-forget
 * event emitter that publishes to an event bus without blocking callers.
 */

import type { PaneDimensions } from "./types.js";

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const MuxEventType = {
  sessionCreated: "mux.session.created",
  sessionReattached: "mux.session.reattached",
  sessionTerminated: "mux.session.terminated",
  paneAdded: "mux.pane.added",
  paneClosed: "mux.pane.closed",
  paneResized: "mux.pane.resized",
  panePtyBound: "mux.pane.pty_bound",
  paneDimensionRejected: "mux.pane.dimension_rejected",
  tabCreated: "mux.tab.created",
  tabClosed: "mux.tab.closed",
  tabSwitched: "mux.tab.switched",
} as const;

export type MuxEventTypeValue = (typeof MuxEventType)[keyof typeof MuxEventType];

// ---------------------------------------------------------------------------
// Base event envelope
// ---------------------------------------------------------------------------

export interface MuxEventBase {
  type: MuxEventTypeValue;
  sessionName: string;
  laneId: string;
  timestamp: number;
  correlationId: string;
}

// ---------------------------------------------------------------------------
// Session events
// ---------------------------------------------------------------------------

export interface SessionCreatedEvent extends MuxEventBase {
  type: typeof MuxEventType.sessionCreated;
}

export interface SessionReattachedEvent extends MuxEventBase {
  type: typeof MuxEventType.sessionReattached;
  recoveredPaneCount: number;
  recoveredTabCount: number;
}

export interface SessionTerminatedEvent extends MuxEventBase {
  type: typeof MuxEventType.sessionTerminated;
}

// ---------------------------------------------------------------------------
// Pane events
// ---------------------------------------------------------------------------

export interface PaneAddedEvent extends MuxEventBase {
  type: typeof MuxEventType.paneAdded;
  paneId: number;
  dimensions: PaneDimensions;
}

export interface PaneClosedEvent extends MuxEventBase {
  type: typeof MuxEventType.paneClosed;
  paneId: number;
}

export interface PaneResizedEvent extends MuxEventBase {
  type: typeof MuxEventType.paneResized;
  paneId: number;
  oldDimensions: PaneDimensions;
  newDimensions: PaneDimensions;
}

export interface PanePtyBoundEvent extends MuxEventBase {
  type: typeof MuxEventType.panePtyBound;
  paneId: number;
  ptyId: string;
}

export interface PaneDimensionRejectedEvent extends MuxEventBase {
  type: typeof MuxEventType.paneDimensionRejected;
  paneId: number;
  requestedDimensions: PaneDimensions;
  minDimensions: PaneDimensions;
}

// ---------------------------------------------------------------------------
// Tab events
// ---------------------------------------------------------------------------

export interface TabCreatedEvent extends MuxEventBase {
  type: typeof MuxEventType.tabCreated;
  tabId: number;
  tabName: string;
}

export interface TabClosedEvent extends MuxEventBase {
  type: typeof MuxEventType.tabClosed;
  tabId: number;
}

export interface TabSwitchedEvent extends MuxEventBase {
  type: typeof MuxEventType.tabSwitched;
  fromTabId: number;
  toTabId: number;
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Event bus interface (minimal contract for DI)
// ---------------------------------------------------------------------------

export interface EventBus {
  publish(event: MuxEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// Correlation ID generator
// ---------------------------------------------------------------------------

let correlationCounter = 0;

export function generateCorrelationId(): string {
  return `mux-${Date.now()}-${++correlationCounter}`;
}

// ---------------------------------------------------------------------------
// MuxEventEmitter - fire-and-forget wrapper around an EventBus
// ---------------------------------------------------------------------------

export class MuxEventEmitter {
  private readonly bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * Emit an event. Bus failures are caught and logged but never propagated.
   */
  emit(event: MuxEvent): void {
    this.bus.publish(event).catch(() => {
      // Best-effort telemetry: bus failures must not block runtime operation.
      // Non-blocking best-effort publish; errors are intentionally ignored.
    });
  }

  /**
   * Helper to build and emit a typed event with common fields populated.
   */
  emitTyped<T extends MuxEvent>(
    partial: Omit<T, "timestamp" | "correlationId"> & { correlationId?: string }
  ): void {
    const event = {
      ...partial,
      timestamp: Date.now(),
      correlationId: partial.correlationId ?? generateCorrelationId(),
    } as unknown as MuxEvent;
    this.emit(event);
  }
}
