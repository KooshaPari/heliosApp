import type { LocalBusEnvelope } from "../protocol/types";

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

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  getRecords(): AuditRecord[] {
    return [...this.records];
  }
}
