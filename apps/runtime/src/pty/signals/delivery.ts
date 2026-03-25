import type { BusPublisher, PtyEventCorrelation } from "../events.js";
import { emitPtyEvent } from "../events.js";
import type { PtyRecord } from "../registry.js";
import { type SignalEnvelope, SignalHistory, type SignalHistoryMap } from "./history.js";

export function createSignalCorrelation(record: PtyRecord): PtyEventCorrelation {
  return {
    ptyId: record.ptyId,
    laneId: record.laneId,
    sessionId: record.sessionId,
    terminalId: record.terminalId,
    correlationId: crypto.randomUUID(),
  };
}

export function recordSignal(
  envelope: SignalEnvelope,
  historyMap: SignalHistoryMap,
  bus: BusPublisher,
  correlation: PtyEventCorrelation
): void {
  let history = historyMap.get(envelope.ptyId);
  if (!history) {
    history = new SignalHistory();
    historyMap.set(envelope.ptyId, history);
  }
  history.add(envelope);

  emitPtyEvent(bus, "pty.signal.delivered", correlation, {
    signal: envelope.signal,
    outcome: envelope.outcome,
    pid: envelope.pid,
    error: envelope.error,
  });
}

export function deliverSignal(
  pid: number,
  signal: string,
  ptyId: string,
  historyMap: SignalHistoryMap,
  bus: BusPublisher,
  correlation: PtyEventCorrelation
): SignalEnvelope {
  const timestamp = Date.now();
  try {
    process.kill(pid, signal);
    const envelope: SignalEnvelope = {
      ptyId,
      signal,
      timestamp,
      outcome: "delivered",
      pid,
    };
    recordSignal(envelope, historyMap, bus, correlation);
    return envelope;
  } catch (error) {
    const envelope: SignalEnvelope = {
      ptyId,
      signal,
      timestamp,
      outcome: "failed",
      pid,
      error: error instanceof Error ? error.message : String(error),
    };
    recordSignal(envelope, historyMap, bus, correlation);
    return envelope;
  }
}
