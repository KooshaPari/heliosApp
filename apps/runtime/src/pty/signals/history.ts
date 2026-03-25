/**
 * Auditable PTY signal history types and bounded storage.
 */

export interface SignalEnvelope {
  readonly ptyId: string;
  readonly signal: string;
  readonly timestamp: number;
  readonly outcome: "delivered" | "failed" | "escalated";
  readonly pid: number;
  readonly error?: string;
}

export class SignalHistory {
  private readonly records: SignalEnvelope[] = [];
  private readonly maxRecords: number;

  constructor(maxRecords = 50) {
    this.maxRecords = maxRecords;
  }

  add(envelope: SignalEnvelope): void {
    this.records.push(envelope);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  getAll(): readonly SignalEnvelope[] {
    return this.records;
  }

  get length(): number {
    return this.records.length;
  }
}

export type SignalHistoryMap = Map<string, SignalHistory>;
