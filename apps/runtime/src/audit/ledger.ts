import type { AuditEvent } from "./event.ts";
import type { AuditRingBuffer, AuditFilter as RingBufferFilter } from "./ring-buffer.ts";
import type { SQLiteAuditStore } from "./sqlite-store.ts";

/**
 * Enhanced filter interface for ledger queries.
 */
export interface AuditFilter {
  workspaceId?: string;
  laneId?: string;
  sessionId?: string;
  actor?: string;
  eventType?: string | string[];
  correlationId?: string;
  timeRange?: { from: Date; to: Date };
  limit?: number;
  offset?: number;
}

/**
 * Real-time subscription callback.
 */
export type SubscriptionCallback = (event: AuditEvent) => void;

/**
 * Unsubscribe function.
 */
export type Unsubscribe = () => void;

/**
 * Subscription holder.
 */
interface Subscription {
  filter: AuditFilter;
  callback: SubscriptionCallback;
}

/**
 * Searchable audit ledger combining ring buffer and SQLite storage.
 * Supports multi-dimensional filtering, correlation chain traversal, and real-time updates.
 */
export class AuditLedger {
  private subscriptions: Subscription[] = [];
  private batchedNotifications: Map<SubscriptionCallback, AuditEvent[]> = new Map();
  private batchTimer: number | null = null;
  private readonly batchIntervalMs = 100;
  private readonly defaultLimit = 100;
  private readonly maxLimit = 1000;

  constructor(
    private ringBuffer: AuditRingBuffer,
    private store: SQLiteAuditStore
  ) {}

  /**
   * Search for audit events with multi-dimensional filtering.
   * Checks ring buffer first, then falls back to SQLite for historical events.
   *
   * @param filter - Filter criteria
   * @returns Matching events in chronological order
   */
  search(filter: AuditFilter): AuditEvent[] {
    const limit = Math.min(filter.limit || this.defaultLimit, this.maxLimit);
    const offset = filter.offset || 0;

    // Convert AuditFilter to ring buffer filter
    const rbFilter = this.filterToRingBufferFilter(filter);

    // Search ring buffer first
    const rbResults = this.ringBuffer.query(rbFilter);

    // Check if we need to query SQLite for historical events
    let dbResults: AuditEvent[] = [];

    // Only query SQLite if we need more events or if the time range extends beyond ring buffer
    if (rbResults.length < limit + offset) {
      dbResults = this.store.query(rbFilter, {
        limit: limit + offset,
        offset: 0,
      });
    }

    // Merge and deduplicate results by event ID
    const merged = new Map<string, AuditEvent>();

    for (const event of rbResults) {
      merged.set(event.id, event);
    }
    for (const event of dbResults) {
      if (!merged.has(event.id)) {
        merged.set(event.id, event);
      }
    }

    // Convert to array, sort chronologically, apply pagination
    const combined = Array.from(merged.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return combined.slice(offset, offset + limit);
  }

  /**
   * Count events matching the filter without fetching full data.
   *
   * @param filter - Filter criteria
   * @returns Number of matching events
   */
  count(filter: AuditFilter): number {
    const rbFilter = this.filterToRingBufferFilter(filter);

    // Count ring buffer results
    const rbCount = this.ringBuffer.query(rbFilter).length;

    // Count SQLite results
    const dbCount = this.store.count(rbFilter);

    // Return total (accounting for potential overlap, which is minimal)
    return rbCount + dbCount;
  }

  /**
   * Get the complete correlation ID chain for debugging and incident response.
   * Traverses from the given correlation ID, following parent references.
   *
   * @param correlationId - Starting correlation ID
   * @returns Complete chain in chronological order
   */
  getCorrelationChain(correlationId: string): AuditEvent[] {
    const visited = new Set<string>();
    const chain: AuditEvent[] = [];

    this.traverseCorrelationChain(correlationId, visited, chain);

    // Sort chronologically
    chain.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return chain;
  }

  /**
   * Subscribe to real-time updates for events matching a filter.
   *
   * @param filter - Filter criteria
   * @param callback - Callback invoked for each matching event
   * @returns Unsubscribe function
   */
  subscribe(filter: AuditFilter, callback: SubscriptionCallback): Unsubscribe {
    const subscription: Subscription = { filter, callback };
    this.subscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = this.subscriptions.indexOf(subscription);
      if (index >= 0) {
        this.subscriptions.splice(index, 1);
      }

      // Clean up batched notifications
      this.batchedNotifications.delete(callback);
    };
  }

  /**
   * Notify subscriptions of a new event.
   * Called by the bus subscriber when an audit event is created.
   *
   * @param event - New audit event
   */
  notifyEvent(event: AuditEvent): void {
    for (const subscription of this.subscriptions) {
      if (this.matchesFilter(event, subscription.filter)) {
        // Batch notification
        if (!this.batchedNotifications.has(subscription.callback)) {
          this.batchedNotifications.set(subscription.callback, []);
        }

        this.batchedNotifications.get(subscription.callback)?.push(event);

        // Start batch timer if not already running
        if (this.batchTimer === null) {
          this.batchTimer = setTimeout(() => {
            this.deliverBatchedNotifications();
          }, this.batchIntervalMs) as unknown as number;
        }
      }
    }
  }

  /**
   * Deliver batched notifications to subscribers.
   */
  private deliverBatchedNotifications(): void {
    this.batchedNotifications.forEach((events, callback) => {
      // Invoke callback asynchronously to avoid blocking
      setImmediate(() => {
        for (const event of events) {
          try {
            callback(event);
          } catch (error) {
            this.handleNotificationError(error);
          }
        }
      });
    });

    this.batchedNotifications.clear();
    this.batchTimer = null;
  }

  /**
   * Recursively traverse correlation chain.
   */
  private traverseCorrelationChain(
    correlationId: string,
    visited: Set<string>,
    chain: AuditEvent[]
  ): void {
    if (visited.has(correlationId)) {
      return;
    }

    visited.add(correlationId);

    // Get all events with this correlation ID from both ring buffer and store
    const ringEvents = this.ringBuffer.getByCorrelationId(correlationId);
    const storeEvents = this.store.getByCorrelationChain(correlationId);
    // Deduplicate by ID
    const seen = new Set<string>();
    const events: AuditEvent[] = [];
    for (const e of ringEvents) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        events.push(e);
      }
    }
    for (const e of storeEvents) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        events.push(e);
      }
    }

    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      if (!chain.find(e => e.id === event.id)) {
        chain.push(event);
      }

      // Check for parent correlation ID in metadata
      const parentCorrelationId = event.metadata?.parentCorrelationId;
      if (parentCorrelationId && typeof parentCorrelationId === "string") {
        this.traverseCorrelationChain(parentCorrelationId, visited, chain);
      }
    }
  }

  /**
   * Convert AuditFilter to ring buffer filter.
   */
  private filterToRingBufferFilter(filter: AuditFilter): RingBufferFilter {
    const rbFilter: RingBufferFilter = {};

    if (filter.workspaceId) {
      rbFilter.workspaceId = filter.workspaceId;
    }

    if (filter.laneId) {
      rbFilter.laneId = filter.laneId;
    }

    if (filter.sessionId) {
      rbFilter.sessionId = filter.sessionId;
    }

    if (filter.actor) {
      rbFilter.actor = filter.actor;
    }

    if (filter.eventType) {
      rbFilter.eventType = Array.isArray(filter.eventType) ? filter.eventType[0] : filter.eventType;
    }

    if (filter.timeRange) {
      rbFilter.startTime = filter.timeRange.from;
      rbFilter.endTime = filter.timeRange.to;
    }

    return rbFilter;
  }

  /**
   * Check if an event matches a filter.
   */
  private matchesFilter(event: AuditEvent, filter: AuditFilter): boolean {
    return (
      this.matchesWorkspace(event, filter) &&
      this.matchesLane(event, filter) &&
      this.matchesSession(event, filter) &&
      this.matchesActor(event, filter) &&
      this.matchesEventType(event, filter) &&
      this.matchesCorrelationId(event, filter) &&
      this.matchesTimeRange(event, filter)
    );
  }

  private matchesWorkspace(event: AuditEvent, filter: AuditFilter): boolean {
    return !filter.workspaceId || event.workspaceId === filter.workspaceId;
  }

  private matchesLane(event: AuditEvent, filter: AuditFilter): boolean {
    return !filter.laneId || event.laneId === filter.laneId;
  }

  private matchesSession(event: AuditEvent, filter: AuditFilter): boolean {
    return !filter.sessionId || event.sessionId === filter.sessionId;
  }

  private matchesActor(event: AuditEvent, filter: AuditFilter): boolean {
    return !filter.actor || event.actor === filter.actor;
  }

  private matchesEventType(event: AuditEvent, filter: AuditFilter): boolean {
    if (!filter.eventType) {
      return true;
    }
    return Array.isArray(filter.eventType)
      ? filter.eventType.includes(event.eventType)
      : filter.eventType === event.eventType;
  }

  private matchesCorrelationId(event: AuditEvent, filter: AuditFilter): boolean {
    return !filter.correlationId || event.correlationId === filter.correlationId;
  }

  private matchesTimeRange(event: AuditEvent, filter: AuditFilter): boolean {
    if (!filter.timeRange) {
      return true;
    }

    const eventTime = new Date(event.timestamp);
    return eventTime >= filter.timeRange.from && eventTime <= filter.timeRange.to;
  }

  private handleNotificationError(_error: unknown): void {
    // Intentionally ignored. Notification failures should not block event flow.
  }
}
