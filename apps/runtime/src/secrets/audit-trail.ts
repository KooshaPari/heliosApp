import { randomBytes } from "node:crypto";
import type { LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import type { RedactionResult, RedactionContext } from "./redaction-engine.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedactionAuditRecord {
  recordId: string;
  artifactId: string;
  artifactType: string;
  timestamp: string;
  rulesApplied: string[];
  matchesByCategory: Record<string, number>;
  latencyMs: number;
  correlationId: string;
}

export interface AuditFilter {
  artifactType?: string;
  since?: Date;
}

// ---------------------------------------------------------------------------
// RedactionAuditTrail
// ---------------------------------------------------------------------------

export class RedactionAuditTrail {
  private records: Map<string, RedactionAuditRecord> = new Map();
  private bus: LocalBus | null;

  constructor(opts?: { bus?: LocalBus }) {
    this.bus = opts?.bus ?? null;
  }

  record(artifactId: string, result: RedactionResult, context: RedactionContext): RedactionAuditRecord {
    const rulesApplied = [...new Set(result.matches.map((m) => m.ruleId))];
    const matchesByCategory: Record<string, number> = {};
    for (const match of result.matches) {
      matchesByCategory[match.category] = (matchesByCategory[match.category] ?? 0) + 1;
    }

    const auditRecord: RedactionAuditRecord = {
      recordId: `audit:${Date.now()}:${randomBytes(4).toString("hex")}`,
      artifactId,
      artifactType: context.artifactType,
      timestamp: new Date().toISOString(),
      rulesApplied,
      matchesByCategory,
      latencyMs: result.latencyMs,
      correlationId: context.correlationId,
    };

    this.records.set(artifactId, auditRecord);
    void this._emit("secrets.redaction.applied", {
      artifactId,
      artifactType: context.artifactType,
      matchCount: result.matches.length,
      rulesApplied,
      matchesByCategory,
      latencyMs: result.latencyMs,
      correlationId: context.correlationId,
    });

    return auditRecord;
  }

  verify(artifactId: string): boolean {
    return this.records.has(artifactId);
  }

  listRecords(filter?: AuditFilter): RedactionAuditRecord[] {
    let records = Array.from(this.records.values());

    if (filter?.artifactType !== undefined) {
      records = records.filter((r) => r.artifactType === filter.artifactType);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      records = records.filter((r) => new Date(r.timestamp) >= since);
    }

    return records;
  }

  private async _emit(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.bus) return;
    const envelope: LocalBusEnvelope = {
      id: `audit:${topic}:${Date.now()}:${randomBytes(4).toString("hex")}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload,
    };
    await this.bus.publish(envelope);
  }
}
