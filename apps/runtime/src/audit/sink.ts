import { AuditEvent } from './event';
import { AuditRingBuffer } from './ring-buffer';

/**
 * Extended metrics including ring buffer and overflow tracking.
 */
export interface AuditSinkMetrics {
  totalEventsWritten: number;
  bufferHighWaterMark: number;
  persistenceFailures: number;
  retryCount: number;
  eventsOverflowed?: number;
  sqliteWriteFailures?: number;
  sqliteRetryCount?: number;
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
  private readonly MAX_BUFFER_SIZE = 10_000;
  private readonly RETRY_BACKOFF_MS = 100;
  private readonly MAX_RETRIES = 5;
  private readonly FLUSH_INTERVAL_MS = 10_000; // 10 seconds

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
    ringBufferCapacity: number = 10_000,
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
      this.metrics.eventsOverflowed!++;
      this.overflowQueue.push(evicted);

      // Try to persist overflow immediately
      this.persistOverflow().catch((err) => {
        console.error('[AuditSink] Overflow persistence failed:', err);
      });
    }

    // Also buffer for periodic flush
    this.buffer.push(event);

    // Update high-water mark
    if (this.buffer.length > this.metrics.bufferHighWaterMark) {
      this.metrics.bufferHighWaterMark = this.buffer.length;
    }

    // Check if buffer is at capacity
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      // Trigger immediate persistence without awaiting
      this.persistWithRetry().catch((err) => {
        // Log error but do not throw; event stays in buffer
        console.error('[AuditSink] Persistence failed, events retained in buffer:', err);
      });
    }
  }

  async flush(): Promise<void> {
    // Persist all buffered events and overflow queue
    if (this.buffer.length === 0 && this.overflowQueue.length === 0) {
      return;
    }

    // Keep trying until all events are persisted
    let retries = 0;
    while ((this.buffer.length > 0 || this.overflowQueue.length > 0) && retries < this.MAX_RETRIES) {
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
        if (retries >= this.MAX_RETRIES) {
          throw new Error(`[AuditSink] Failed to flush after ${this.MAX_RETRIES} retries: ${err}`);
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_BACKOFF_MS * retries));
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

      while (retries < this.MAX_RETRIES) {
        try {
          // Snapshot buffer for persistence
          const eventsToPersist = [...this.buffer];

          // Persist to storage backend
          await this.storage.persist(eventsToPersist);

          // Clear buffer on success
          this.buffer = [];
          break;
        } catch (err) {
          this.metrics.persistenceFailures++;
          this.metrics.retryCount++;

          retries++;
          if (retries < this.MAX_RETRIES) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, this.RETRY_BACKOFF_MS * Math.pow(2, retries - 1)),
            );
          }
        }
      }

      if (this.buffer.length > 0) {
        // Events still in buffer after retries; they will be retried on next write
        console.warn('[AuditSink] Events retained in buffer after retries; will retry on next write');
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

    while (retries < this.MAX_RETRIES && this.overflowQueue.length > 0) {
      try {
        const eventsToPersist = [...this.overflowQueue];
        await this.storage.persist(eventsToPersist);

        // Clear overflow queue on success
        this.overflowQueue = [];
        break;
      } catch (err) {
        this.metrics.sqliteWriteFailures!++;
        this.metrics.sqliteRetryCount!++;

        retries++;
        if (retries < this.MAX_RETRIES) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, this.RETRY_BACKOFF_MS * Math.pow(2, retries - 1)),
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
        this.persistWithRetry().catch((err) => {
          console.error('[AuditSink] Periodic flush failed:', err);
        });
      }
    }, this.FLUSH_INTERVAL_MS) as unknown as number;
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
 * In-memory sink for testing.
 */
export class InMemoryAuditSink implements AuditSink {
  private records: AuditEvent[] = [];
  private metrics: AuditSinkMetrics = {
    totalEventsWritten: 0,
    bufferHighWaterMark: 0,
    persistenceFailures: 0,
    retryCount: 0
  };

  async write(event: AuditEvent): Promise<void> {
    this.records.push(event);
    this.metrics.totalEventsWritten++;
    if (this.records.length > this.metrics.bufferHighWaterMark) {
      this.metrics.bufferHighWaterMark = this.records.length;
    }
  }

  async flush(): Promise<void> {}

  getBufferedCount(): number {
    return 0;
  }

  getMetrics(): AuditSinkMetrics {
    return { ...this.metrics };
  }

  getRecords(): AuditEvent[] {
    return [...this.records];
  }

  async append(event: AuditEvent): Promise<void> {
    await this.write(event);
  }

  async enforceRetention(days: number): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    this.records = this.records.filter((r) => new Date(r.recorded_at) >= cutoff);
  }
}

