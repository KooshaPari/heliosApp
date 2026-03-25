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

export type ErrorPayload = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown> | null;
};

type EnvelopeBase = {
  id: string;
  type: EnvelopeType;
  correlation_id: string;
  workspace_id?: string;
  session_id?: string;
  terminal_id?: string;
  lane_id?: string;
};

export type CommandEnvelope = EnvelopeBase & {
  type: "command";
  timestamp: number;
  method: string;
  payload: unknown;
};

export type ResponseEnvelope = EnvelopeBase & {
  type: "response";
  timestamp: number;
  method: string;
  payload: unknown;
  error?: ErrorPayload;
};

export type EventEnvelope = EnvelopeBase & {
  type: "event";
  timestamp: number;
  topic: string;
  payload: unknown;
  sequence: number;
};

export type Envelope = CommandEnvelope | ResponseEnvelope | EventEnvelope;

export type LocalBusEnvelope = {
  id: string;
  type: EnvelopeType;
  ts: string;
  timestamp?: string | number;
  correlation_id?: string;
  workspace_id?: string;
  session_id?: string;
  terminal_id?: string;
  lane_id?: string;
  method?: string;
  topic?: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  status?: "ok" | "error";
  result?: Record<string, unknown> | null;
  error?: ErrorPayload | null;
};

export function isCommand(value: unknown): value is CommandEnvelope {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "command" &&
    typeof (value as Record<string, unknown>).method === "string" &&
    typeof (value as Record<string, unknown>).correlation_id === "string" &&
    typeof (value as Record<string, unknown>).timestamp === "number"
  );
}

export function isResponse(value: unknown): value is ResponseEnvelope {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "response" &&
    typeof (value as Record<string, unknown>).method === "string" &&
    typeof (value as Record<string, unknown>).correlation_id === "string" &&
    typeof (value as Record<string, unknown>).timestamp === "number"
  );
}

export function isEvent(value: unknown): value is EventEnvelope {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "event" &&
    typeof (value as Record<string, unknown>).topic === "string" &&
    typeof (value as Record<string, unknown>).correlation_id === "string" &&
    typeof (value as Record<string, unknown>).timestamp === "number" &&
    typeof (value as Record<string, unknown>).sequence === "number"
  );
}
