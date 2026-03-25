import type { LocalBusEnvelope } from "../protocol/types.js";
import type { AuditEvent } from "./event.ts";

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

export interface AuditRecord {
  recorded_at: string;
  sequence: number | null;
  outcome: AuditOutcome;
  reason: string | null;
  envelope: LocalBusEnvelope | Record<string, unknown>;
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
  envelope: Record<string, unknown>;
  type?: string;
  status?: "ok" | "error";
  payload?: Record<string, unknown>;
}

export interface AuditFilter {
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  correlation_id?: string;
}

export interface AuditBundle {
  generated_at: string;
  filters: AuditFilter;
  count: number;
  records: AuditExportRecord[];
}
