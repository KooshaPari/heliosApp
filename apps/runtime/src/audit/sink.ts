import type { LocalBusEnvelope } from "../protocol/types";

export type AuditOutcome = "accepted" | "rejected";

export type AuditFilter = {
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  correlation_id?: string;
};

export type AuditRecord = {
  id: string;
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
  action?: string;
  type?: "command" | "response" | "event" | "system";
  status?: "ok" | "error";
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  terminal_id?: string;
  correlation_id?: string;
  error_code?: string;
  payload?: Record<string, unknown>;
};

export type AuditBundle = {
  generated_at: string;
  filters: AuditFilter;
  count: number;
  records: AuditRecord[];
};

export interface AuditSink {
  append(record: {
    recorded_at: string;
    sequence: number | null;
    outcome: AuditOutcome;
    reason: string | null;
    envelope: LocalBusEnvelope | Record<string, unknown>;
  }): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly records: AuditRecord[] = [];

  async append(record: {
    recorded_at: string;
    sequence: number | null;
    outcome: AuditOutcome;
    reason: string | null;
    envelope: LocalBusEnvelope | Record<string, unknown>;
  }): Promise<void> {
    this.records.push(this.enrichRecord(record));
  }

  async appendSystem(input: {
    action: string;
    ts: string;
    status: "ok" | "error";
    payload?: Record<string, unknown>;
    correlation_id?: string;
    error_code?: string;
  }): Promise<void> {
    const envelope: Record<string, unknown> = {
      type: "event",
      topic: "audit.recorded",
      correlation_id: input.correlation_id,
      payload: input.payload ?? {}
    };

    await this.append({
      recorded_at: input.ts,
      sequence: null,
      outcome: input.status === "ok" ? "accepted" : "rejected",
      reason: input.status === "ok" ? null : input.error_code ?? "system_error",
      envelope
    });

    const last = this.records[this.records.length - 1];
    if (last) {
      last.action = input.action;
      last.type = "system";
      last.status = input.status;
      last.error_code = input.error_code;
      last.payload = sanitize(input.payload ?? {});
    }
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
  }

  query(filter: AuditFilter = {}): AuditRecord[] {
    return this.records.filter((record) => {
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
    const envelope = sanitizeEnvelope(record.envelope);
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

function sanitizeEnvelope(envelope: LocalBusEnvelope | Record<string, unknown>): Record<string, unknown> {
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
