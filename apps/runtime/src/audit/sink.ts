import type { AuditEvent } from "./event";
import { AuditRingBuffer } from "./ring-buffer";

export type AuditOutcome = "accepted" | "rejected";

export type AuditRecord = {
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
};

export interface AuditSink {
  append(record: AuditRecord): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly records: AuditRecord[] = [];

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
      this.metrics.eventsOverflowed!++;
      this.overflowQueue.push(evicted);

      // Try to persist overflow immediately
      this.persistOverflow().catch(_err => {});
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
      this.persistWithRetry().catch(_err => {});
    }
  }

  async flush(): Promise<void> {
    // Persist all buffered events and overflow queue
    if (this.buffer.length === 0 && this.overflowQueue.length === 0) {
      return;
    }

    // Keep trying until all events are persisted
    let retries = 0;
    while (
      (this.buffer.length > 0 || this.overflowQueue.length > 0) &&
      retries < this.MAX_RETRIES
    ) {
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
        await new Promise(resolve => setTimeout(resolve, this.RETRY_BACKOFF_MS * retries));
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
        } catch (_err) {
          this.metrics.persistenceFailures++;
          this.metrics.retryCount++;

          retries++;
          if (retries < this.MAX_RETRIES) {
            // Exponential backoff
            await new Promise(resolve =>
              setTimeout(resolve, this.RETRY_BACKOFF_MS * 2 ** (retries - 1))
            );
          }
        }
      }

      if (this.buffer.length > 0) {
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
      } catch (_err) {
        this.metrics.sqliteWriteFailures!++;
        this.metrics.sqliteRetryCount!++;

        retries++;
        if (retries < this.MAX_RETRIES) {
          // Exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, this.RETRY_BACKOFF_MS * 2 ** (retries - 1))
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
        this.persistWithRetry().catch(_err => {});
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
 * No-op storage for testing and development.
 * Events are buffered but never persisted.
 */
export class NoOpAuditStorage implements AuditStorage {
  async persist(_events: AuditEvent[]): Promise<void> {
    // Do nothing; events are discarded
  }
}
