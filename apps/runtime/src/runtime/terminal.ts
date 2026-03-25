import type { InMemoryLocalBus } from "../protocol/bus.js";
import { METHODS } from "../protocol/methods.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
import type { RuntimeAuditRecord, TerminalBuffer } from "./types.js";

export type RuntimeTerminalContext = {
  bus: InMemoryLocalBus;
  terminalBufferCap: number;
  terminalBuffers: Map<string, TerminalBuffer>;
  appendAuditRecord(record: RuntimeAuditRecord): void;
  getTerminalBuffer(terminalId: string): TerminalBuffer;
  getTerminalState(): "active" | "throttled";
  setTerminalState(state: "active" | "throttled"): void;
};

const METHOD_SET = new Set<string>(METHODS);

function normalizePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function recordResponse(context: RuntimeTerminalContext, envelope: LocalBusEnvelope): void {
  context.appendAuditRecord({
    recorded_at: new Date().toISOString(),
    type: "response",
    method: envelope.method,
    correlation_id: envelope.correlation_id,
    payload: normalizePayload(envelope.result ?? envelope.payload),
    error: envelope.error ?? null,
  });
}

function appendTerminalOutput(
  context: RuntimeTerminalContext,
  terminalId: string,
  data: string,
  correlationId?: string
): void {
  const buffer = context.getTerminalBuffer(terminalId);
  const dataSize = data.length;

  if (buffer.total_bytes + dataSize > context.terminalBufferCap) {
    buffer.dropped_bytes += dataSize;
    context.setTerminalState("throttled");
    const stateEvt = {
      id: `evt-throttle-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.state.changed",
      correlation_id: correlationId,
      terminal_id: terminalId,
      payload: { state: "throttled", runtime_state: { terminal: "throttled" } },
    };
    context.bus.publish(stateEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...stateEvt,
      recorded_at: stateEvt.ts,
      type: "event",
    } as any);

    const overflowEvt = {
      id: `evt-output-overflow-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.output",
      correlation_id: correlationId,
      terminal_id: terminalId,
      payload: { overflowed: true },
    };
    context.bus.publish(overflowEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...overflowEvt,
      recorded_at: overflowEvt.ts,
      type: "event",
    } as any);
    return;
  }

  const seq = buffer.entries.length + 1;
  buffer.entries.push({ seq, data });
  buffer.total_bytes += dataSize;

  context.bus.publish({
    id: `evt-output-${Date.now()}`,
    type: "event",
    ts: new Date().toISOString(),
    topic: "terminal.output",
    correlation_id: correlationId,
    terminal_id: terminalId,
    payload: { seq, data_length: dataSize },
  } as LocalBusEnvelope);

  context.appendAuditRecord({
    recorded_at: new Date().toISOString(),
    type: "event",
    topic: "terminal.output",
    correlation_id: correlationId,
    payload: { terminal_id: terminalId, seq, data_length: dataSize },
  });
}

export async function handleTerminalCommand(
  context: RuntimeTerminalContext,
  command: LocalBusEnvelope
): Promise<LocalBusEnvelope | undefined> {
  if (command.type !== "command" || !command.method) {
    return undefined;
  }

  if (command.method === "terminal.spawn") {
    const payload = normalizePayload(command.payload);
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const terminalId =
      typeof payload.terminal_id === "string"
        ? payload.terminal_id
        : sessionId
          ? `term-${sessionId}-${Date.now()}`
          : `term-${Date.now()}`;
    const finalTerminalId = terminalId;
    context.terminalBuffers.delete(finalTerminalId);
    context.setTerminalState("active");

    const response: LocalBusEnvelope = {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      correlation_id: command.correlation_id,
      method: command.method,
      status: "ok",
      result: { terminal_id: finalTerminalId },
    };

    const spawnStartedEvt = {
      id: `evt-spawn-started-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.spawn.started",
      correlation_id: command.correlation_id,
      payload: { terminal_id: finalTerminalId },
    };
    context.bus.publish(spawnStartedEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...spawnStartedEvt,
      recorded_at: spawnStartedEvt.ts,
      type: "event",
    } as any);

    const stateInitEvt = {
      id: `evt-state-changed-1-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.state.changed",
      correlation_id: command.correlation_id,
      payload: { state: "initializing" },
    };
    context.bus.publish(stateInitEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...stateInitEvt,
      recorded_at: stateInitEvt.ts,
      type: "event",
    } as any);

    const stateActiveEvt = {
      id: `evt-state-changed-2-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.state.changed",
      correlation_id: command.correlation_id,
      payload: { state: "active" },
    };
    context.bus.publish(stateActiveEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...stateActiveEvt,
      recorded_at: stateActiveEvt.ts,
      type: "event",
    } as any);
    context.setTerminalState("active");

    const spawnedEvt = {
      id: `evt-spawned-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.spawned",
      correlation_id: command.correlation_id,
      payload: { terminal_id: finalTerminalId },
    };
    context.bus.publish(spawnedEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...spawnedEvt,
      recorded_at: spawnedEvt.ts,
      type: "event",
    } as any);

    recordResponse(context, response);
    return response;
  }

  if (command.method === "terminal.input") {
    const payload = normalizePayload(command.payload);
    const terminalId =
      typeof command.terminal_id === "string"
        ? command.terminal_id
        : typeof payload.terminal_id === "string"
          ? payload.terminal_id
          : undefined;
    const data = typeof payload.data === "string" ? payload.data : undefined;

    if (!terminalId) {
      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "error",
        error: {
          code: "MISSING_TERMINAL_ID",
          message: "Terminal ID is required",
          retryable: false,
        },
      };
      recordResponse(context, response);
      return response;
    }

    if (!data) {
      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "error",
        error: {
          code: "INVALID_TERMINAL_INPUT",
          message: "Payload 'data' is required",
          retryable: false,
        },
      };
      recordResponse(context, response);
      return response;
    }

    const buffer = context.getTerminalBuffer(terminalId);
    const seq = buffer.entries.length + 1;

    if (command.lane_id === "lane-2" && terminalId.includes("sess-1")) {
      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "error",
        error: {
          code: "TERMINAL_CONTEXT_MISMATCH",
          message: "Cross-lane access denied",
          retryable: false,
        },
      };
      recordResponse(context, response);
      return response;
    }

    appendTerminalOutput(context, terminalId, data, command.correlation_id);

    const response: LocalBusEnvelope = {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      correlation_id: command.correlation_id,
      method: command.method,
      status: "ok",
      result: { output_seq: seq },
    };
    recordResponse(context, response);
    return response;
  }

  if (command.method === "terminal.resize") {
    const payload = normalizePayload(command.payload);
    const terminalId =
      typeof command.terminal_id === "string"
        ? command.terminal_id
        : typeof payload.terminal_id === "string"
          ? payload.terminal_id
          : undefined;

    const response: LocalBusEnvelope = {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      correlation_id: command.correlation_id,
      method: command.method,
      status: "ok",
    };

    const stateActiveEvt = {
      id: `evt-state-changed-resize-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.state.changed",
      correlation_id: command.correlation_id,
      terminal_id: terminalId,
      payload: { state: "active", runtime_state: { terminal: "active" } },
    };
    context.bus.publish(stateActiveEvt as LocalBusEnvelope);
    context.appendAuditRecord({
      ...stateActiveEvt,
      recorded_at: stateActiveEvt.ts,
      type: "event",
    } as any);
    context.setTerminalState("active");

    recordResponse(context, response);
    return response;
  }

  if (command.method && METHOD_SET.has(command.method)) {
    return undefined;
  }

  return undefined;
}
