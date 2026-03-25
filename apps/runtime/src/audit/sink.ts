import type { AuditEvent } from "./event";
import { AuditRingBuffer } from "./ring-buffer";
<<<<<<< HEAD

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
=======
import type { AuditFilter } from "./ring-buffer";
import type { LocalBusEnvelope } from "../protocol/types.js";
import {
  type AuditOutcome,
  type AuditRecord,
  type AuditExportRecord,
  type RetentionPolicyConfig,
  type AuditBundle,
  type AuditSinkMetrics,
  toExportRecord,
  shouldRetainRecord,
  buildDeletionProofRecord,
  sanitizeEnvelopeSimple,
  sanitize,
  getString,
  inferType,
  getRecordPayload,
  isSensitiveKey,
} from "./sink-helpers.js";

export type {
  AuditOutcome,
  AuditRecord,
  AuditExportRecord,
  RetentionPolicyConfig,
  AuditBundle,
  AuditSinkMetrics,
} from "./sink-helpers.js";
>>>>>>> origin/main

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
<<<<<<< HEAD
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
=======
  write(event: AuditEvent): Promise<void>;
  flush(): Promise<void>;
  getBufferedCount(): number;
>>>>>>> origin/main
  getMetrics(): AuditSinkMetrics;
}

/**
 * Default implementation of AuditSink with ring buffer and SQLite persistence.
 * Integrates WP01 (sink) with WP02 (ring buffer and storage).
 */
export class DefaultAuditSink implements AuditSink {
  private buffer: AuditEvent[] = [];
  private ringBuffer: AuditRingBuffer;
<<<<<<< HEAD
  private readonly MAX_BUFFER_SIZE = 10_000;
  private readonly RETRY_BACKOFF_MS = 100;
  private readonly MAX_RETRIES = 5;
  private readonly FLUSH_INTERVAL_MS = 10_000; // 10 seconds
=======
  private storage: AuditStorage;
  readonly records: AuditRecord[] = [];
  retentionPolicy: RetentionPolicyConfig = {
    retention_days: 90,
    redacted_fields: [],
    exempt_topics: [],
  };
  private readonly MAX_BUFFER_SIZE = 10_000;
  private readonly RETRY_BACKOFF_MS = 100;
  private readonly MAX_RETRIES = 5;
  private readonly FLUSH_INTERVAL_MS = 10_000;
>>>>>>> origin/main

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
<<<<<<< HEAD
    private storage: AuditStorage,
    ringBufferCapacity = 10_000
  ) {
=======
    storageOrConfig?: AuditStorage | Record<string, unknown>,
    ringBufferCapacity: number = 10_000
  ) {
    if (storageOrConfig && typeof (storageOrConfig as AuditStorage).persist === "function") {
      this.storage = storageOrConfig as AuditStorage;
    } else {
      this.storage = new NoOpAuditStorage();
      if (
        storageOrConfig &&
        typeof storageOrConfig === "object" &&
        "retention_days" in storageOrConfig
      ) {
        this.retentionPolicy = {
          ...this.retentionPolicy,
          retention_days: storageOrConfig.retention_days as number,
        };
      }
    }
>>>>>>> origin/main
    this.ringBuffer = new AuditRingBuffer(ringBufferCapacity);
    this.startPeriodicFlush();
  }

<<<<<<< HEAD
  async write(event: AuditEvent): Promise<void> {
    // Non-blocking: push to ring buffer (< 1ms)
    this.metrics.totalEventsWritten++;
    const evicted = this.ringBuffer.push(event);

    // If an event was evicted from ring buffer, persist it immediately to SQLite
=======
  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  getRecords(): AuditRecord[] {
    return this.records;
  }

  async write(event: AuditEvent): Promise<void> {
    this.metrics.totalEventsWritten++;
    const evicted = this.ringBuffer.push(event);

>>>>>>> origin/main
    if (evicted) {
      this.metrics.eventsOverflowed!++;
      this.overflowQueue.push(evicted);

<<<<<<< HEAD
      // Try to persist overflow immediately
      this.persistOverflow().catch(_err => {});
    }

    // Also buffer for periodic flush
    this.buffer.push(event);

    // Update high-water mark
=======
      this.persistOverflow().catch(err => {
        console.error("[AuditSink] Overflow persistence failed:", err);
      });
    }

    this.buffer.push(event);

>>>>>>> origin/main
    if (this.buffer.length > this.metrics.bufferHighWaterMark) {
      this.metrics.bufferHighWaterMark = this.buffer.length;
    }

<<<<<<< HEAD
    // Check if buffer is at capacity
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      // Trigger immediate persistence without awaiting
      this.persistWithRetry().catch(_err => {});
=======
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.persistWithRetry().catch(err => {
        console.error("[AuditSink] Persistence failed, events retained in buffer:", err);
      });
>>>>>>> origin/main
    }
  }

  async flush(): Promise<void> {
<<<<<<< HEAD
    // Persist all buffered events and overflow queue
=======
>>>>>>> origin/main
    if (this.buffer.length === 0 && this.overflowQueue.length === 0) {
      return;
    }

<<<<<<< HEAD
    // Keep trying until all events are persisted
=======
>>>>>>> origin/main
    let retries = 0;
    while (
      (this.buffer.length > 0 || this.overflowQueue.length > 0) &&
      retries < this.MAX_RETRIES
    ) {
      try {
<<<<<<< HEAD
        // First flush overflow queue
        if (this.overflowQueue.length > 0) {
          await this.persistOverflow();
        }

        // Then flush main buffer
        if (this.buffer.length > 0) {
          await this.persistWithRetry();
        }

=======
        if (this.overflowQueue.length > 0) {
          await this.persistOverflow();
        }
        if (this.buffer.length > 0) {
          await this.persistWithRetry();
        }
>>>>>>> origin/main
        break;
      } catch (err) {
        retries++;
        if (retries >= this.MAX_RETRIES) {
          throw new Error(`[AuditSink] Failed to flush after ${this.MAX_RETRIES} retries: ${err}`);
        }
<<<<<<< HEAD
        // Wait before retry
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
  /**
   * Persist buffered events with exponential backoff retry.
   * Private method for internal use.
   */
=======
>>>>>>> origin/main
  private async persistWithRetry(): Promise<void> {
    if (this.persistenceInProgress || this.buffer.length === 0) {
      return;
    }

    this.persistenceInProgress = true;

    try {
      let retries = 0;
<<<<<<< HEAD

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
=======
      while (retries < this.MAX_RETRIES) {
        try {
          const eventsToPersist = [...this.buffer];
          await this.storage.persist(eventsToPersist);
          this.buffer = [];
          break;
        } catch (err) {
          this.metrics.persistenceFailures++;
          this.metrics.retryCount++;
          retries++;
          if (retries < this.MAX_RETRIES) {
            await new Promise(resolve =>
              setTimeout(resolve, this.RETRY_BACKOFF_MS * Math.pow(2, retries - 1))
>>>>>>> origin/main
            );
          }
        }
      }

      if (this.buffer.length > 0) {
<<<<<<< HEAD
=======
        console.warn(
          "[AuditSink] Events retained in buffer after retries; will retry on next write"
        );
>>>>>>> origin/main
      }
    } finally {
      this.persistenceInProgress = false;
    }
  }

<<<<<<< HEAD
  /**
   * Persist overflow events to SQLite.
   */
=======
>>>>>>> origin/main
  private async persistOverflow(): Promise<void> {
    if (this.overflowQueue.length === 0) {
      return;
    }

    let retries = 0;
<<<<<<< HEAD

=======
>>>>>>> origin/main
    while (retries < this.MAX_RETRIES && this.overflowQueue.length > 0) {
      try {
        const eventsToPersist = [...this.overflowQueue];
        await this.storage.persist(eventsToPersist);
<<<<<<< HEAD

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
=======
        this.overflowQueue = [];
        break;
      } catch (err) {
        this.metrics.sqliteWriteFailures!++;
        this.metrics.sqliteRetryCount!++;
        retries++;
        if (retries < this.MAX_RETRIES) {
          await new Promise(resolve =>
            setTimeout(resolve, this.RETRY_BACKOFF_MS * Math.pow(2, retries - 1))
>>>>>>> origin/main
          );
        }
      }
    }
  }

<<<<<<< HEAD
  /**
   * Start periodic flush timer.
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 || this.overflowQueue.length > 0) {
        this.persistWithRetry().catch(_err => {});
=======
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 || this.overflowQueue.length > 0) {
        this.persistWithRetry().catch(err => {
          console.error("[AuditSink] Periodic flush failed:", err);
        });
>>>>>>> origin/main
      }
    }, this.FLUSH_INTERVAL_MS) as unknown as number;
  }

<<<<<<< HEAD
  /**
   * Stop periodic flush timer.
   */
=======
>>>>>>> origin/main
  private stopPeriodicFlush(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

<<<<<<< HEAD
  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.stopPeriodicFlush();
  }
=======
  destroy(): void {
    this.stopPeriodicFlush();
  }

  async enforceRetention(now: Date = new Date()): Promise<{ deleted_count: number }> {
    const keep: AuditRecord[] = [];
    const expired: AuditRecord[] = [];
    for (const record of this.records) {
      if (shouldRetainRecord(record, this.retentionPolicy, now)) {
        keep.push(record);
      } else {
        expired.push(record);
      }
    }

    this.records.length = 0;
    this.records.push(...keep);

    if (expired.length > 0) {
      this.records.push(buildDeletionProofRecord(expired.length, now));
    }

    return { deleted_count: expired.length };
  }

  async exportRecords(): Promise<AuditExportRecord[]> {
    return this.records.map(record => toExportRecord(record, this.retentionPolicy));
  }
>>>>>>> origin/main
}

/**
 * No-op storage for testing and development.
 * Events are buffered but never persisted.
 */
export class NoOpAuditStorage implements AuditStorage {
<<<<<<< HEAD
  async persist(_events: AuditEvent[]): Promise<void> {
    // Do nothing; events are discarded
  }
}
=======
  readonly records: AuditRecord[] = [];

  async persist(_events: AuditEvent[]): Promise<void> {
    // Do nothing; events are discarded
  }

  query(filter: AuditFilter = {}): AuditRecord[] {
    return this.records.filter(record => {
      if (filter.workspaceId && record.workspace_id !== filter.workspaceId) {
        return false;
      }
      if (filter.laneId && record.lane_id !== filter.laneId) {
        return false;
      }
      if (filter.sessionId && record.session_id !== filter.sessionId) {
        return false;
      }
      if (filter.correlationId && record.correlation_id !== filter.correlationId) {
        return false;
      }
      return true;
    });
  }

  exportBundle(filter: AuditFilter = {}): AuditBundle {
    const records = this.query(filter);
    return {
      generated_at: new Date().toISOString(),
      filters: { ...filter },
      count: records.length,
      records,
    };
  }

  private enrichRecord(record: {
    recorded_at: string;
    sequence: number | null;
    outcome: AuditOutcome;
    reason: string | null;
    envelope: LocalBusEnvelope | Record<string, unknown>;
  }): AuditRecord {
    const envelope = sanitizeEnvelopeSimple(record.envelope);
    const payload = sanitize(getRecordPayload(envelope));

    return {
      id: `${record.recorded_at}:${this.records.length + 1}`,
      recorded_at: record.recorded_at,
      sequence: record.sequence,
      outcome: record.outcome,
      reason: record.reason,
      envelope,
      action: getString(envelope.topic) ?? getString(envelope.method) ?? "audit.recorded",
      type: inferType(envelope),
      status: record.outcome === "accepted" ? "ok" : "error",
      workspace_id: getString(envelope.workspace_id),
      lane_id:
        getString(envelope.lane_id) ??
        getString((envelope.payload as Record<string, unknown>)?.lane_id),
      session_id:
        getString(envelope.session_id) ??
        getString((envelope.payload as Record<string, unknown>)?.session_id),
      terminal_id:
        getString(envelope.terminal_id) ??
        getString((envelope.payload as Record<string, unknown>)?.terminal_id),
      correlation_id: getString(envelope.correlation_id),
      error_code: getString((envelope.error as Record<string, unknown>)?.code),
      payload,
    };
  }
}

/** @deprecated Use DefaultAuditSink. Alias retained for backward compatibility. */
export { DefaultAuditSink as InMemoryAuditSink };
>>>>>>> origin/main
