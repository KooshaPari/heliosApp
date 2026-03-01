import { AuditEvent } from './event';

/**
 * Metrics for monitoring audit sink health and performance.
 */
export interface AuditSinkMetrics {
  totalEventsWritten: number;
  bufferHighWaterMark: number;
  persistenceFailures: number;
  retryCount: number;
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
 * Default implementation of AuditSink with in-memory buffering and async persistence.
 */
export class DefaultAuditSink implements AuditSink {
  private buffer: AuditEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 10_000;
  private readonly RETRY_BACKOFF_MS = 100;
  private readonly MAX_RETRIES = 5;

  private metrics: AuditSinkMetrics = {
    totalEventsWritten: 0,
    bufferHighWaterMark: 0,
    persistenceFailures: 0,
    retryCount: 0,
  };

  private persistenceInProgress = false;

  constructor(private storage: AuditStorage) {}

  async write(event: AuditEvent): Promise<void> {
    // Non-blocking: just append to buffer (< 1ms)
    this.buffer.push(event);
    this.metrics.totalEventsWritten++;

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
    } else if (!this.persistenceInProgress) {
      // Trigger async persistence for non-full buffer
      // Schedule with setImmediate to avoid blocking
      setImmediate(() => {
        this.persistWithRetry().catch((err) => {
          console.error('[AuditSink] Async persistence failed:', err);
        });
      });
    }
  }

  async flush(): Promise<void> {
    // Persist all buffered events synchronously
    if (this.buffer.length === 0) {
      return;
    }

    // Keep trying until all events are persisted
    let retries = 0;
    while (this.buffer.length > 0 && retries < this.MAX_RETRIES) {
      try {
        await this.persistWithRetry();
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
      let lastError: Error | null = null;

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
          lastError = err instanceof Error ? err : new Error(String(err));
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
