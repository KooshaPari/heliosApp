export class ProtocolValidationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ProtocolValidationError";
    this.code = code;
    this.details = details;
  }
}

export type EnvelopeType = "command" | "response" | "event";

export type ErrorCode = string;

export type ErrorPayload = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | null;
};

type EnvelopeContext = {
  workspace_id?: string;
  session_id?: string;
  terminal_id?: string;
  lane_id?: string;
};

type EnvelopeBase = EnvelopeContext & {
  id: string;
  type: EnvelopeType;
  correlation_id?: string;
  timestamp?: number;
  ts?: string;
};

export type CommandEnvelope = EnvelopeBase & {
  type: "command";
  method: string;
  payload: unknown;
};

export type ResponseEnvelope = EnvelopeBase & {
  type: "response";
  method: string;
  payload?: unknown;
  result?: Record<string, unknown> | null;
  status?: "ok" | "error";
  error?: ErrorPayload | null;
};

export type EventEnvelope = EnvelopeBase & {
  type: "event";
  topic: string;
  payload: unknown;
  sequence: number;
};

export type Envelope = CommandEnvelope | ResponseEnvelope | EventEnvelope;

export type LocalBusEnvelope = EnvelopeBase & {
  method?: string;
  topic?: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  status?: "ok" | "error";
  result?: Record<string, unknown> | null;
  error?: ErrorPayload | null;
  sequence?: number;
};

export type LocalBusEnvelopeWithSequence = LocalBusEnvelope & { sequence: number };

export class ProtocolValidationError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ProtocolValidationError";
    this.code = code;
    this.details = details;
  }
}

export function isCommand(envelope: Envelope): envelope is CommandEnvelope {
  return envelope.type === "command";
}

export function isResponse(envelope: Envelope): envelope is ResponseEnvelope {
  return envelope.type === "response";
}

export function isEvent(envelope: Envelope): envelope is EventEnvelope {
  return envelope.type === "event";
}
