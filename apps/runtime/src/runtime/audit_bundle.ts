import type { AuditExportRecord, AuditFilter } from "../audit/sink";
import { InMemoryLocalBus } from "../protocol/bus";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    redacted[key] = /api[_-]?key|secret|password|token|bearer/i.test(key)
      ? "[REDACTED]"
      : redactValue(nested);
  }
  return redacted;
}

export function matchAuditFilter(record: AuditExportRecord, filter: AuditFilter): boolean {
  if (filter.workspace_id && record.workspace_id !== filter.workspace_id) {
    return false;
  }
  if (filter.lane_id && record.lane_id !== filter.lane_id) {
    return false;
  }
  if (filter.session_id && record.session_id !== filter.session_id) {
    return false;
  }
  if (filter.correlation_id && record.correlation_id !== filter.correlation_id) {
    return false;
  }
  return true;
}

export function toAuditBundleRecord(
  record: Awaited<ReturnType<InMemoryLocalBus["getAuditRecords"]>>[number],
): AuditExportRecord {
  const envelope = record.envelope;
  const payload = isRecord(envelope.payload) ? redactValue(envelope.payload) : envelope.payload;
  const redactedEnvelope = redactValue(envelope) as Record<string, unknown>;

  return {
    recorded_at: record.recorded_at ?? new Date().toISOString(),
    sequence:
      "sequence" in envelope && typeof envelope.sequence === "number" ? envelope.sequence : null,
    outcome: record.outcome,
    reason: record.error ?? null,
    envelope_id: envelope.id,
    envelope_type: envelope.type,
    correlation_id: envelope.correlation_id ?? null,
    workspace_id: envelope.workspace_id ?? null,
    lane_id: envelope.lane_id ?? null,
    session_id: envelope.session_id ?? null,
    terminal_id: envelope.terminal_id ?? null,
    method_or_topic: envelope.method ?? envelope.topic ?? null,
    envelope: redactedEnvelope,
    type: envelope.type,
    status: envelope.status,
    payload: isRecord(payload) ? payload : undefined,
  };
}
