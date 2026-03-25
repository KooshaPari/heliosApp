import { MuxEventType, type EventBus, type MuxEvent } from "./types.js";

let correlationCounter = 0;

export function generateCorrelationId(): string {
  return `mux-${Date.now()}-${++correlationCounter}`;
}

export class MuxEventEmitter {
  private readonly bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  emit(event: MuxEvent): void {
    this.bus.publish(event).catch((err) => {
      console.warn(
        `[mux-events] Bus publish failed for ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  emitTyped<T extends MuxEvent>(
    partial: Omit<T, "timestamp" | "correlationId"> & { correlationId?: string },
  ): void {
    const event = {
      ...partial,
      timestamp: Date.now(),
      correlationId: partial.correlationId ?? generateCorrelationId(),
    } as unknown as MuxEvent;
    this.emit(event);
  }
}
