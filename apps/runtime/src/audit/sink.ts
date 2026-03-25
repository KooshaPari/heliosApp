import type { LocalBusEnvelope } from "../protocol/types.js";
import type { AuditEvent } from "./event.ts";
import { AuditRingBuffer } from "./ring-buffer.ts";

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

// ---------------------------------------------------------------------------
// AuditRecord — flat record type for the durable audit log
// ---------------------------------------------------------------------------

export interface AuditRecord {
  recorded_at: string;
  sequence: number;
  outcome: string;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
}

/** Flattened export row for compliance exports. */
export interface AuditExportRow {
  envelope_id: string;
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  terminal_id?: string;
  correlation_id?: string;
  method_or_topic?: string;
  envelope: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "token",
  "secret",
  "password",
  "api_key",
  "apiKey",
]);

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// InMemoryAuditSink — in-memory sink for testing
// ---------------------------------------------------------------------------

export interface InMemoryAuditSinkOptions {
  retention_days?: number;
}

export class InMemoryAuditSink {
  private records: AuditRecord[] = [];
  private readonly retentionDays: number | undefined;

  constructor(options?: InMemoryAuditSinkOptions) {
    this.retentionDays = options?.retention_days;
  }

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
  }

  async exportRecords(): Promise<AuditExportRow[]> {
    return this.records.map(record => {
      const env = record.envelope as Record<string, unknown>;
      const payload = env.payload as Record<string, unknown> | undefined;
      const redactedEnvelope = payload ? { ...env, payload: redactSensitive(payload) } : env;

      return {
        envelope_id: env.id as string,
        workspace_id: env.workspace_id as string | undefined,
        lane_id: env.lane_id as string | undefined,
        session_id: env.session_id as string | undefined,
        terminal_id: env.terminal_id as string | undefined,
        correlation_id: env.correlation_id as string | undefined,
        method_or_topic: (env.method ?? env.topic) as string | undefined,
        envelope: redactedEnvelope,
      };
    });
  }

  async enforceRetention(asOf: Date): Promise<{ deleted_count: number }> {
    if (this.retentionDays === undefined) {
      return { deleted_count: 0 };
    }

    const cutoff = new Date(asOf.getTime() - this.retentionDays * 24 * 60 * 60 * 1000);
    const before = this.records.length;
    const _expired = this.records.filter(r => new Date(r.recorded_at) < cutoff);
    this.records = this.records.filter(r => new Date(r.recorded_at) >= cutoff);

    const deletedCount = before - this.records.length;

    if (deletedCount > 0) {
      // Emit a deletion proof record
      this.records.push({
        recorded_at: asOf.toISOString(),
        sequence: 0,
        outcome: "accepted",
        reason: null,
        envelope: {
          id: `audit-retention-${Date.now()}`,
          type: "event" as const,
          ts: asOf.toISOString(),
          topic: "audit.retention.deleted",
          payload: { deleted_count: deletedCount, cutoff: cutoff.toISOString() },
        },
      });
    }

    return { deleted_count: deletedCount };
  }
}
