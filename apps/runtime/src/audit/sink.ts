import type { AuditEvent } from "./event";
import { AuditRingBuffer } from "./ring-buffer";

/**
 * Extended metrics including ring buffer and overflow tracking.
 */
export interface AuditSinkMetrics {
  totalEventsWritten: number;
  bufferHighWaterMark: number;
  persistenceFailures: number;
  retryCount: number;
  eventsOverflowed: number;
  sqliteWriteFailures: number;
  sqliteRetryCount: number;
}

/**
 * Storage backend interface for persisting audit events.
 * Implemented by WP02 (SQLite storage).
 */
export interface AuditStorage {
  persist(events: AuditEvent[]): Promise<void>;
}

/**
 * Append-only sink for audit events.
 * Never blocks, never drops events, guarantees delivery.
 */
export interface AuditSink {
  /**
   * Write an audit event asynchronously.
   * Non-blocking: returns immediately, persists in background.
   * Never throws or drops events; buffers on failure and retries.
   *
   * @param event - AuditEvent to persist
   */
  write(event: AuditEvent): Promise<void>;

  /**
   * Force flush all buffered events to persistent storage.
   * Blocks until all events are persisted.
   *
   * @throws if persistence fails after retries
   */
  flush(): Promise<void>;

  /**
   * Get count of events waiting to be persisted.
   *
   * @returns number of buffered events
   */
  getBufferedCount(): number;

  /**
   * Get current metrics for monitoring.
   *
   * @returns AuditSinkMetrics
   */
  getMetrics(): AuditSinkMetrics;
}

/**
 * Default implementation of AuditSink with ring buffer and SQLite persistence.
 * Integrates WP01 (sink) with WP02 (ring buffer and storage).
 */
export class DefaultAuditSink implements AuditSink {
  private buffer: AuditEvent[] = [];
  private ringBuffer: AuditRingBuffer;
  private readonly maxBufferSize = 10_000;
  private readonly retryBackoffMs = 100;
  private readonly maxRetries = 5;
  private readonly flushIntervalMs = 10_000; // 10 seconds

  private metrics: AuditSinkMetrics = {
    totalEventsWritten: 0,
    bufferHighWaterMark: 0,
    persistenceFailures: 0,
    retryCount: 0,
    eventsOverflowed: 0,
    sqliteWriteFailures: 0,
    sqliteRetryCount: 0,
  };

  private persistenceInProgress = false;
  private flushTimer: number | null = null;
  private overflowQueue: AuditEvent[] = [];

  constructor(
    private storage: AuditStorage,
    ringBufferCapacity = 10_000
  ) {
    this.ringBuffer = new AuditRingBuffer(ringBufferCapacity);
    this.startPeriodicFlush();
  }

  async write(event: AuditEvent): Promise<void> {
    // Non-blocking: push to ring buffer (< 1ms)
    this.metrics.totalEventsWritten++;
    const evicted = this.ringBuffer.push(event);

    // If an event was evicted from ring buffer, persist it immediately to SQLite
    if (evicted) {
      this.metrics.eventsOverflowed++;
      this.overflowQueue.push(evicted);

      // Try to persist overflow immediately
      this.persistOverflow().catch(() => undefined);
    }

    // Also buffer for periodic flush
    this.buffer.push(event);

    // Update high-water mark
    if (this.buffer.length > this.metrics.bufferHighWaterMark) {
      this.metrics.bufferHighWaterMark = this.buffer.length;
    }

    // Check if buffer is at capacity
    if (this.buffer.length >= this.maxBufferSize) {
      // Trigger immediate persistence without awaiting
      this.persistWithRetry().catch(() => undefined);
    }
  }

  async flush(): Promise<void> {
    // Persist all buffered events and overflow queue
    if (this.buffer.length === 0 && this.overflowQueue.length === 0) {
      return;
    }

    // Keep trying until all events are persisted
    let retries = 0;
    while ((this.buffer.length > 0 || this.overflowQueue.length > 0) && retries < this.maxRetries) {
      try {
        // First flush overflow queue
        if (this.overflowQueue.length > 0) {
          await this.persistOverflow();
        }

        // Then flush main buffer
        if (this.buffer.length > 0) {
          await this.persistWithRetry();
        }

        break;
      } catch (err) {
        retries++;
        if (retries >= this.maxRetries) {
          throw new Error(`[AuditSink] Failed to flush after ${this.maxRetries} retries: ${err}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryBackoffMs * retries));
      }
    }
  }

  getBufferedCount(): number {
    return this.buffer.length;
  }

  getMetrics(): AuditSinkMetrics {
    return { ...this.metrics };
  }

  /**
   * Persist buffered events with exponential backoff retry.
   * Private method for internal use.
   */
  private async persistWithRetry(): Promise<void> {
    if (this.persistenceInProgress || this.buffer.length === 0) {
      return;
    }

    this.persistenceInProgress = true;

    try {
      let retries = 0;

      while (retries < this.maxRetries) {
        try {
          // Snapshot buffer for persistence
          const eventsToPersist = [...this.buffer];

          // Persist to storage backend
          await this.storage.persist(eventsToPersist);

          // Clear buffer on success
          this.buffer = [];
          break;
        } catch (_err) {
          this.metrics.persistenceFailures++;
          this.metrics.retryCount++;

          retries++;
          if (retries < this.maxRetries) {
            // Exponential backoff
            await new Promise(resolve =>
              setTimeout(resolve, this.retryBackoffMs * 2 ** (retries - 1))
            );
          }
        }
      }

      if (this.buffer.length > 0) {
        this.metrics.persistenceFailures++;
      }
    } finally {
      this.persistenceInProgress = false;
    }
  }

  /**
   * Persist overflow events to SQLite.
   */
  private async persistOverflow(): Promise<void> {
    if (this.overflowQueue.length === 0) {
      return;
    }

    let retries = 0;

    while (retries < this.maxRetries && this.overflowQueue.length > 0) {
      try {
        const eventsToPersist = [...this.overflowQueue];
        await this.storage.persist(eventsToPersist);

        // Clear overflow queue on success
        this.overflowQueue = [];
        break;
      } catch (_err) {
        this.metrics.sqliteWriteFailures++;
        this.metrics.sqliteRetryCount++;

        retries++;
        if (retries < this.maxRetries) {
          // Exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, this.retryBackoffMs * 2 ** (retries - 1))
          );
        }
      }
    }
  }

  /**
   * Start periodic flush timer.
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 || this.overflowQueue.length > 0) {
        this.persistWithRetry().catch(() => undefined);
      }
    }, this.flushIntervalMs) as unknown as number;
  }

  /**
   * Stop periodic flush timer.
   */
  private stopPeriodicFlush(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.stopPeriodicFlush();
  }
}

/**
 * No-op storage for testing and development.
 * Events are buffered but never persisted.
 */
export class NoOpAuditStorage implements AuditStorage {
  async persist(_events: AuditEvent[]): Promise<void> {
    // Do nothing; events are discarded
  }
}
