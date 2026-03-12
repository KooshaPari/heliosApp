import type { AuditEvent } from './event';
import { AuditRingBuffer } from './ring-buffer';
import type { AuditFilter } from './ring-buffer';
import type { LocalBusEnvelope } from '../protocol/types.js';

export type AuditOutcome = "accepted" | "rejected";

export interface AuditRecord {
  id?: string;
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
  action?: string;
  type?: "command" | "response" | "event" | "system";
  status?: "ok" | "error";
  workspace_id?: string | null;
  lane_id?: string | null;
  session_id?: string | null;
  terminal_id?: string | null;
  correlation_id?: string | null;
  error_code?: string | null;
  payload?: unknown;
}

export interface AuditExportRecord {
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope_id: string;
  envelope_type: string;
  correlation_id: string | null;
  workspace_id: string | null;
  lane_id: string | null;
  session_id: string | null;
  terminal_id: string | null;
  method_or_topic: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
}

export interface RetentionPolicyConfig {
  retention_days: number;
  redacted_fields: string[];
  exempt_topics: string[];
}

export interface AuditBundle {
  generated_at: string;
  filters: Record<string, unknown>;
  count: number;
  records: AuditRecord[];
}

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
    storageOrConfig?: AuditStorage | Record<string, unknown>,
    ringBufferCapacity: number = 10_000,
  ) {
    if (storageOrConfig && typeof (storageOrConfig as AuditStorage).persist === "function") {
      this.storage = storageOrConfig as AuditStorage;
    } else {
      this.storage = new NoOpAuditStorage();
      if (storageOrConfig && typeof storageOrConfig === "object" && "retention_days" in storageOrConfig) {
        this.retentionPolicy = {
          ...this.retentionPolicy,
          retention_days: storageOrConfig.retention_days as number,
        };
      }
    }
    this.ringBuffer = new AuditRingBuffer(ringBufferCapacity);
    this.startPeriodicFlush();
  }

  /** Append an audit record directly (test/compat API). */
  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  /** Alias for records (test/compat API). */
  getRecords(): AuditRecord[] {
    return this.records;
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
    return this.records.map((record) => toExportRecord(record, this.retentionPolicy));
  }
}

function toExportRecord(record: AuditRecord, policy: RetentionPolicyConfig): AuditExportRecord {
  const envelope = sanitizeEnvelope(record.envelope, policy.redacted_fields);
  const envelopeObject = envelope as Record<string, unknown>;
  const methodOrTopic =
    readString(envelopeObject.method) ?? readString(envelopeObject.topic) ?? null;

  return {
    recorded_at: record.recorded_at,
    sequence: record.sequence,
    outcome: record.outcome,
    reason: record.reason,
    envelope_id: readString(envelopeObject.envelope_id) ?? readString(envelopeObject.id) ?? "unknown",
    envelope_type: readString(envelopeObject.type) ?? "unknown",
    correlation_id: readString(envelopeObject.correlation_id) ?? null,
    workspace_id: readString(envelopeObject.workspace_id) ?? null,
    lane_id: readString(envelopeObject.lane_id) ?? null,
    session_id: readString(envelopeObject.session_id) ?? null,
    terminal_id: readString(envelopeObject.terminal_id) ?? null,
    method_or_topic: methodOrTopic,
    envelope
  };
}

function sanitizeEnvelope(
  envelope: LocalBusEnvelope | Record<string, unknown>,
  redactedFields: string[]
): LocalBusEnvelope | Record<string, unknown> {
  const redactionSet = new Set(redactedFields.map((field) => field.toLowerCase()));
  return deepRedact(envelope, redactionSet) as LocalBusEnvelope | Record<string, unknown>;
}

function deepRedact(value: unknown, redactionSet: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, redactionSet));
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      if (redactionSet.has(key.toLowerCase())) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = deepRedact(nested, redactionSet);
      }
    }
    return output;
  }
  return value;
}

function shouldRetainRecord(
  record: AuditRecord,
  policy: RetentionPolicyConfig,
  now: Date
): boolean {
  const topic = readEnvelopeTopic(record.envelope);
  if (topic && policy.exempt_topics.includes(topic)) {
    return true;
  }

  const recordedAtMs = Date.parse(record.recorded_at);
  if (Number.isNaN(recordedAtMs)) {
    return true;
  }

  const ttlMs = policy.retention_days * 24 * 60 * 60 * 1000;
  return now.getTime() - recordedAtMs <= ttlMs;
}

function readEnvelopeTopic(envelope: LocalBusEnvelope | Record<string, unknown>): string | null {
  if (!envelope || typeof envelope !== "object") {
    return null;
  }
  const value = (envelope as Record<string, unknown>).topic;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildDeletionProofRecord(expiredCount: number, now: Date): AuditRecord {
  return {
    recorded_at: now.toISOString(),
    sequence: null,
    outcome: "accepted",
    reason: "retention_enforced",
    envelope: {
      id: `audit.retention.deleted:${now.getTime()}`,
      type: "event",
      ts: now.toISOString(),
      topic: "audit.retention.deleted",
      payload: {
        deleted_count: expiredCount
      }
    }
  };
}

function readString(input: unknown): string | null {
  return typeof input === "string" && input.length > 0 ? input : null;
}

/**
 * No-op storage for testing and development.
 * Events are buffered but never persisted.
 */
export class NoOpAuditStorage implements AuditStorage {
  readonly records: AuditRecord[] = [];

  async persist(_events: AuditEvent[]): Promise<void> {
    // Do nothing; events are discarded
  }

  query(filter: AuditFilter = {}): AuditRecord[] {
    return this.records.filter((record) => {
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
      records
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
      lane_id: getString(envelope.lane_id) ?? getString((envelope.payload as Record<string, unknown>)?.lane_id),
      session_id:
        getString(envelope.session_id) ?? getString((envelope.payload as Record<string, unknown>)?.session_id),
      terminal_id:
        getString(envelope.terminal_id) ?? getString((envelope.payload as Record<string, unknown>)?.terminal_id),
      correlation_id: getString(envelope.correlation_id),
      error_code: getString((envelope.error as Record<string, unknown>)?.code),
      payload
    };
  }
}

function inferType(envelope: Record<string, unknown>): AuditRecord["type"] {
  const value = envelope.type;
  if (value === "command" || value === "response" || value === "event") {
    return value;
  }
  return "system";
}

function getRecordPayload(envelope: Record<string, unknown>): unknown {
  return envelope.payload ?? envelope.result ?? envelope.error ?? {};
}

function sanitizeEnvelopeSimple(envelope: LocalBusEnvelope | Record<string, unknown>): Record<string, unknown> {
  return sanitize(envelope) as Record<string, unknown>;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (isSensitiveKey(key)) {
          return [key, "[REDACTED]"];
        }
        return [key, sanitize(item)];
      })
    );
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  return /(token|secret|password|api[_-]?key|authorization|bearer)/i.test(key);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** @deprecated Use DefaultAuditSink. Alias retained for backward compatibility. */
export { DefaultAuditSink as InMemoryAuditSink };
