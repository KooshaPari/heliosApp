import type { LocalBusEnvelope } from "../protocol/types.ts";

type ResponseError = {
  code: string;
  message: string;
  retryable: false;
};

type ProtocolResponseBase = {
  id: string;
  type: "response";
  ts: string;
  correlation_id: string;
};

export type ProtocolResponse<TResult> = ProtocolResponseBase & {
  status: "ok" | "error";
  result?: TResult;
  error?: ResponseError;
};

export type TerminalState = "active" | "throttled" | "inactive";

export type TerminalRecord = {
  terminal_id: string;
  workspace_id: string;
  lane_id: string;
  session_id: string;
  state: TerminalState;
};

type BufferEntry = {
  seq: number;
  data: string;
  bytes: number;
};

export type TerminalBuffer = {
  entries: BufferEntry[];
  total_bytes: number;
  dropped_bytes: number;
  cap_bytes: number;
  next_seq: number;
};

export function createTerminalBuffer(capBytes: number): TerminalBuffer {
  return {
    entries: [],
    total_bytes: 0,
    dropped_bytes: 0,
    cap_bytes: capBytes,
    next_seq: 1,
  };
}

export function makeTerminalId(sessionId: string): string {
  return `terminal_${sessionId}_${Date.now()}`;
}

export function errorResponse(
  correlationId: string,
  code: string,
  message: string
): ProtocolResponse<never> {
  return {
    id: `res-${Date.now()}`,
    type: "response",
    ts: new Date().toISOString(),
    status: "error",
    correlation_id: correlationId,
    error: {
      code,
      message,
      retryable: false,
    },
  };
}

export function cloneBuffer(buffer: TerminalBuffer): TerminalBuffer {
  return {
    ...buffer,
    entries: buffer.entries.map(entry => ({ ...entry })),
  };
}

export function isTerminalRecord(value: unknown): value is TerminalRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isTerminalOutputEnvelope(
  envelope: LocalBusEnvelope
): envelope is LocalBusEnvelope & {
  topic: "terminal.output";
  payload: Record<string, unknown>;
} {
  return (
    envelope.topic === "terminal.output" &&
    Boolean(envelope.payload) &&
    typeof envelope.payload === "object"
  );
}
