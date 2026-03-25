import type { RetentionPolicyConfig } from "../config/retention";
import { createRetentionPolicyConfig } from "../config/retention";
import type { LocalBusEnvelope } from "../protocol/types.js";
import type {
  AuditBundle,
  AuditExportRecord,
  AuditFilter,
  AuditRecord,
} from "./sink_types";
import type { SessionSnapshot } from "./snapshot";

export class InMemoryAuditSink {
  private readonly retentionPolicy: RetentionPolicyConfig;
  private readonly records: AuditRecord[] = [];

  constructor(policy: Partial<RetentionPolicyConfig> = {}) {
    this.retentionPolicy = createRetentionPolicyConfig(policy);
  }

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
    this.records.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
  }

  async enforceRetention(now: Date = new Date()): Promise<{ deleted_count: number }> {
    const keep: AuditRecord[] = [];
    let deletedCount = 0;

    for (const record of this.records) {
      if (shouldRetainRecord(record, this.retentionPolicy, now)) {
        keep.push(record);
      } else {
        deletedCount += 1;
      }
    }

    this.records.length = 0;
    this.records.push(...keep);
    if (deletedCount > 0) {
      this.records.push(buildDeletionProofRecord(deletedCount, now));
    }
    return { deleted_count: deletedCount };
  }

  async exportRecords(): Promise<AuditExportRecord[]> {
    return this.query().map((record) => toExportRecord(record, this.retentionPolicy));
  }

  query(filter: AuditFilter = {}): AuditRecord[] {
    return this.records.filter((record) => {
      const envelope = record.envelope as Record<string, unknown>;
      if (filter.workspace_id && getString(envelope.workspace_id) !== filter.workspace_id) return false;
      if (filter.lane_id && getString(envelope.lane_id) !== filter.lane_id) return false;
      if (filter.session_id && getString(envelope.session_id) !== filter.session_id) return false;
      if (filter.correlation_id && getString(envelope.correlation_id) !== filter.correlation_id) return false;
      return true;
    });
  }

  exportBundle(filter: AuditFilter = {}): AuditBundle {
    const records = this.query(filter).map((record) => toExportRecord(record, this.retentionPolicy));
    return {
      generated_at: new Date().toISOString(),
      filters: { ...filter },
      count: records.length,
      records,
    };
  }
}

function toExportRecord(record: AuditRecord, policy: RetentionPolicyConfig): AuditExportRecord {
  const envelope = sanitizeEnvelope(record.envelope, policy.redacted_fields);
  const payload = getRecordPayload(envelope);
  const envelopeId = getString(envelope.id) ?? "unknown";
  const envelopeType = getString(envelope.type) ?? "unknown";
  const methodOrTopic = getString(envelope.method) ?? getString(envelope.topic) ?? null;
  const outcomeStatus = record.outcome === "accepted" ? "ok" : "error";

  return {
    recorded_at: record.recorded_at,
    sequence: record.sequence,
    outcome: record.outcome,
    reason: record.reason,
    envelope_id: envelopeId,
    envelope_type: envelopeType,
    correlation_id: getString(envelope.correlation_id) ?? null,
    workspace_id: getString(envelope.workspace_id) ?? null,
    lane_id: getString(envelope.lane_id) ?? null,
    session_id: getString(envelope.session_id) ?? null,
    terminal_id: getString(envelope.terminal_id) ?? null,
    method_or_topic: methodOrTopic,
    envelope,
    type: envelopeType === "command" || envelopeType === "response" || envelopeType === "event"
      ? envelopeType
      : "system",
    status: outcomeStatus,
    payload,
  };
}

function getRecordPayload(envelope: Record<string, unknown>): Record<string, unknown> {
  const candidate = envelope.payload ?? envelope.result ?? envelope.error ?? {};
  return (sanitize(candidate) as Record<string, unknown>) ?? {};
}

function shouldRetainRecord(
  record: AuditRecord,
  policy: RetentionPolicyConfig,
  now: Date,
): boolean {
  const topic = getString((record.envelope as Record<string, unknown>).topic);
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
      payload: { deleted_count: expiredCount },
    },
  };
}

function sanitizeEnvelope(
  envelope: LocalBusEnvelope | Record<string, unknown>,
  redactedFields: string[],
): Record<string, unknown> {
  const redactionSet = new Set(redactedFields.map((field) => field.toLowerCase()));
  return deepRedact(envelope, redactionSet) as Record<string, unknown>;
}

function deepRedact(value: unknown, redactionSet: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, redactionSet));
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      output[key] = redactionSet.has(key.toLowerCase()) ? "[REDACTED]" : deepRedact(nested, redactionSet);
    }
    return output;
  }
  return value;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /(token|secret|password|api[_-]?key|authorization|bearer)/i.test(key)
          ? "[REDACTED]"
          : sanitize(item),
      ]),
    );
  }
  return value;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
