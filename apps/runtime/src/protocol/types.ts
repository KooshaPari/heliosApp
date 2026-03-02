export type EnvelopeType = "command" | "response" | "event";

export type ErrorPayload = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown> | null;
};

export type LocalBusEnvelope = {
  id: string;
  type: EnvelopeType;
  ts: string;
  timestamp?: string | undefined;
  correlation_id?: string | undefined;
  workspace_id?: string | undefined;
  session_id?: string | undefined;
  terminal_id?: string | undefined;
  lane_id?: string | undefined;
  method?: string | undefined;
  topic?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  status?: "ok" | "error" | undefined;
  result?: Record<string, unknown> | null | undefined;
  error?: ErrorPayload | null | undefined;
  sequence?: number | undefined;
  envelope_id?: string | undefined;
};

// ---------------------------------------------------------------------------
// Envelope types for the bus.ts / envelope.ts subsystem
// ---------------------------------------------------------------------------

export type BusError = {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
};

export type CommandEnvelope = {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "command";
  method: string;
  payload: unknown;
  error?: BusError;
};

export type ResponseEnvelope = {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "response";
  method: string;
  payload: unknown;
  error?: BusError;
};

export type EventEnvelope = {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "event";
  topic: string;
  payload: unknown;
  sequence: number;
};

export type Envelope = CommandEnvelope | ResponseEnvelope | EventEnvelope;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isCommand(env: Envelope): env is CommandEnvelope {
  return env.type === "command";
}

export function isResponse(env: Envelope): env is ResponseEnvelope {
  return env.type === "response";
}

export function isEvent(env: Envelope): env is EventEnvelope {
  return env.type === "event";
}

// ---------------------------------------------------------------------------
// ProtocolValidationError
// ---------------------------------------------------------------------------

export class ProtocolValidationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ProtocolValidationError";
    this.code = code;
    this.details = details;
  }
}
