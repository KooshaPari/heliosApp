/**
 * Domain Event
 *
 * Domain events represent something that happened in the domain that
 * other parts of the system might care about.
 */
export interface DomainEvent {
  readonly occurredAt: Date;
  readonly eventType: string;
}

/**
 * Base class for domain events with common properties
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredAt: Date;

  constructor(public readonly eventType: string) {
    this.occurredAt = new Date();
  }

  /**
   * JSON serialization for event bus transport
   */
  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
