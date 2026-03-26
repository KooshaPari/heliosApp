import { createRetentionPolicyConfig, type RetentionPolicyConfig } from "../config/retention.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import type { AuditEvent } from "./event";
import { AuditRingBuffer } from "./ring-buffer";

export interface AuditSinkMetrics {
  totalEventsWritten: number;
  bufferHighWaterMark: number;
  persistenceFailures: number;
  retryCount: number;
  eventsOverflowed?: number;
  sqliteWriteFailures?: number;
  sqliteRetryCount?: number;
}

export interface AuditStorage {
  persist(events: AuditEvent[]): Promise<void>;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
  flush(): Promise<void>;
  getBufferedCount(): number;
  getMetrics(): AuditSinkMetrics;
}

export type AuditOutcome = "accepted" | "rejected";

export type AuditRecord = {
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
};

export type AuditFilter = {
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  correlation_id?: string;
};

export type AuditBundle = {
  generated_at: string;
  filters: AuditFilter;
  count: number;
  records: AuditRecord[];
};

export type AuditExportRecord = {
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
};

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
  private readonly FLUSH_INTERVAL_MS = 10_000;

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
    ringBufferCapacity = 10_000
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
    this.ringBuffer = new AuditRingBuffer(ringBufferCapacity);
    this.startPeriodicFlush();
  }

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  getRecords(): AuditRecord[] {
    return this.records;
  }

  async write(event: AuditEvent): Promise<void> {
    this.metrics.totalEventsWritten++;
    const evicted = this.ringBuffer.push(event);

    if (evicted) {
      this.metrics.eventsOverflowed = (this.metrics.eventsOverflowed ?? 0) + 1;
      this.overflowQueue.push(evicted);
      this.persistOverflow().catch(_err => {});
    }

    this.buffer.push(event);
    if (this.buffer.length > this.metrics.bufferHighWaterMark) {
      this.metrics.bufferHighWaterMark = this.buffer.length;
    }

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.persistWithRetry().catch(_err => {});
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 && this.overflowQueue.length === 0) {
      return;
    }

    let retries = 0;
    while (
      (this.buffer.length > 0 || this.overflowQueue.length > 0) &&
      retries < this.MAX_RETRIES
    ) {
      try {
        if (this.overflowQueue.length > 0) {
          await this.persistOverflow();
        }
        if (this.buffer.length > 0) {
          await this.persistWithRetry();
        }
        break;
      } catch (err) {
        retries += 1;
        if (retries >= this.MAX_RETRIES) {
          throw new Error(`[AuditSink] Failed to flush after ${this.MAX_RETRIES} retries: ${err}`);
        }
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

  destroy(): void {
    this.stopPeriodicFlush();
  }

  private async persistWithRetry(): Promise<void> {
    if (this.persistenceInProgress || this.buffer.length === 0) {
      return;
    }

    this.persistenceInProgress = true;
    try {
      let retries = 0;
      while (retries < this.MAX_RETRIES) {
        try {
          const eventsToPersist = [...this.buffer];
          await this.storage.persist(eventsToPersist);
          this.buffer = [];
          break;
        } catch {
          this.metrics.persistenceFailures += 1;
          this.metrics.retryCount += 1;
          retries += 1;
          if (retries < this.MAX_RETRIES) {
            await new Promise(resolve =>
              setTimeout(resolve, this.RETRY_BACKOFF_MS * 2 ** (retries - 1))
            );
          }
        }
      }
    } finally {
      this.persistenceInProgress = false;
    }
  }

  private async persistOverflow(): Promise<void> {
    if (this.overflowQueue.length === 0) {
      return;
    }

    let retries = 0;
    while (retries < this.MAX_RETRIES && this.overflowQueue.length > 0) {
      try {
        const eventsToPersist = [...this.overflowQueue];
        await this.storage.persist(eventsToPersist);
        this.overflowQueue = [];
        break;
      } catch {
        this.metrics.sqliteWriteFailures = (this.metrics.sqliteWriteFailures ?? 0) + 1;
        this.metrics.sqliteRetryCount = (this.metrics.sqliteRetryCount ?? 0) + 1;
        retries += 1;
        if (retries < this.MAX_RETRIES) {
          await new Promise(resolve =>
            setTimeout(resolve, this.RETRY_BACKOFF_MS * 2 ** (retries - 1))
          );
        }
      }
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 || this.overflowQueue.length > 0) {
        this.persistWithRetry().catch(_err => {});
      }
    }, this.FLUSH_INTERVAL_MS) as unknown as number;
  }

  private stopPeriodicFlush(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export class NoOpAuditStorage implements AuditStorage {
  async persist(_events: AuditEvent[]): Promise<void> {
    // Intentionally discarded.
  }
}

export class InMemoryAuditSink {
  private readonly retentionPolicy: RetentionPolicyConfig;
  private readonly records: AuditRecord[] = [];

  constructor(input: Partial<RetentionPolicyConfig> = {}) {
    this.retentionPolicy = createRetentionPolicyConfig(input);
  }

  async append(record: AuditRecord): Promise<void> {
    this.records.push({
      ...record,
      envelope: sanitizeEnvelope(record.envelope, this.retentionPolicy.redacted_fields),
    });
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
  }

  query(filter: AuditFilter = {}): AuditRecord[] {
    return this.records.filter(record => {
      const envelope = record.envelope as Record<string, unknown>;
      if (filter.workspace_id && getString(envelope.workspace_id) !== filter.workspace_id) {
        return false;
      }
      if (filter.lane_id && getString(envelope.lane_id) !== filter.lane_id) {
        return false;
      }
      if (filter.session_id && getString(envelope.session_id) !== filter.session_id) {
        return false;
      }
      if (filter.correlation_id && getString(envelope.correlation_id) !== filter.correlation_id) {
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
}

function toExportRecord(record: AuditRecord, policy: RetentionPolicyConfig): AuditExportRecord {
  const envelope = sanitizeEnvelope(record.envelope, policy.redacted_fields);
  const envelopeObject = envelope as Record<string, unknown>;
  const methodOrTopic = getString(envelopeObject.method) ?? getString(envelopeObject.topic) ?? null;

  return {
    recorded_at: record.recorded_at,
    sequence: record.sequence,
    outcome: record.outcome,
    reason: record.reason,
    envelope_id: getString(envelopeObject.id) ?? "unknown",
    envelope_type: getString(envelopeObject.type) ?? "unknown",
    correlation_id: getString(envelopeObject.correlation_id) ?? null,
    workspace_id: getString(envelopeObject.workspace_id) ?? null,
    lane_id: getString(envelopeObject.lane_id) ?? null,
    session_id: getString(envelopeObject.session_id) ?? null,
    terminal_id: getString(envelopeObject.terminal_id) ?? null,
    method_or_topic: methodOrTopic,
    envelope,
  };
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
  return getString((envelope as Record<string, unknown>).topic) ?? null;
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
        deleted_count: expiredCount,
      },
    },
  };
}

function sanitizeEnvelope(
  envelope: LocalBusEnvelope | Record<string, unknown>,
  redactedFields: string[]
): LocalBusEnvelope | Record<string, unknown> {
  const redactionSet = new Set(redactedFields.map(field => field.toLowerCase()));
  return deepRedact(envelope, redactionSet) as LocalBusEnvelope | Record<string, unknown>;
}

function deepRedact(value: unknown, redactionSet: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => deepRedact(entry, redactionSet));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (redactionSet.has(key.toLowerCase())) {
          return [key, "[REDACTED]"];
        }
        return [key, deepRedact(item, redactionSet)];
      })
    );
  }
  return value;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
