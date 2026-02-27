import type { LocalBusEnvelope } from "../protocol/types";
import { createRetentionPolicyConfig, type RetentionPolicyConfig } from "../config/retention";

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

export interface AuditRetentionSink extends AuditSink {
  enforceRetention(now?: Date): Promise<{ deleted_count: number }>;
  exportRecords(): Promise<AuditExportRecord[]>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly records: AuditRecord[] = [];
  private readonly retentionPolicy: RetentionPolicyConfig;

  constructor(policy?: Partial<RetentionPolicyConfig>) {
    this.retentionPolicy = createRetentionPolicyConfig(policy);
  }

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
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
