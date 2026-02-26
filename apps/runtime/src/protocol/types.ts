import type { ProtocolMethod } from "./methods";
import type { ProtocolTopic } from "./topics";

export type EnvelopeType = "command" | "response" | "event";

export type EnvelopeStatus = "ok" | "error";

export type EnvelopeActor = {
  kind: string;
  id: string;
};

export type ErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | null;
};

type EnvelopeBase = {
  id: string;
  type: EnvelopeType;
  ts: string;
  sequence?: number;
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  terminal_id?: string;
  actor?: EnvelopeActor;
  correlation_id?: string;
  envelope_id?: string;
  timestamp?: string;
};

export type CommandEnvelope = EnvelopeBase & {
  type: "command";
  method: ProtocolMethod;
  payload: Record<string, unknown>;
  topic?: never;
  status?: never;
  result?: never;
  error?: never;
};

export type EventEnvelope = EnvelopeBase & {
  type: "event";
  topic: ProtocolTopic;
  payload: Record<string, unknown>;
  method?: never;
  status?: never;
  result?: never;
  error?: never;
};

export type ResponseEnvelope = EnvelopeBase & {
  type: "response";
  status: EnvelopeStatus;
  method?: ProtocolMethod;
  topic?: ProtocolTopic;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: ErrorPayload | null;
};

export type LocalBusEnvelope = CommandEnvelope | EventEnvelope | ResponseEnvelope;

export type ProtocolErrorCode =
  | "MALFORMED_ENVELOPE"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_ENVELOPE_TYPE"
  | "INVALID_METHOD"
  | "INVALID_TOPIC"
  | "INVALID_STATUS"
  | "INVALID_TIMESTAMP"
  | "INVALID_ERROR_PAYLOAD"
  | "MISSING_CORRELATION_ID"
  | "MISSING_CONTEXT_ID"
  | "ORDERING_VIOLATION";

export class ProtocolValidationError extends Error {
  readonly code: ProtocolErrorCode;
  readonly details: Record<string, unknown> | null;

  constructor(code: ProtocolErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ProtocolValidationError";
    this.code = code;
    this.details = details ?? null;
  }
}

export function isCommandEnvelope(envelope: LocalBusEnvelope): envelope is CommandEnvelope {
  return envelope.type === "command";
}

export function isEventEnvelope(envelope: LocalBusEnvelope): envelope is EventEnvelope {
  return envelope.type === "event";
}

export function isResponseEnvelope(envelope: LocalBusEnvelope): envelope is ResponseEnvelope {
  return envelope.type === "response";
}
