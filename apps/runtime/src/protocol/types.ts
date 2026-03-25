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
  retryable: boolean;
  details?: Record<string, unknown> | null;
};

export interface CommandEnvelope {
  id: string;
  type: "command";
  ts?: string;
  timestamp?: number;
  method: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  terminal_id?: string;
}

export interface EventEnvelope {
  id?: string;
  type: "event";
  topic: string;
  ts?: string;
  timestamp?: number;
  correlation_id?: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  workspace_id?: string;
  lane_id?: string;
  session_id?: string;
  terminal_id?: string;
}

export interface ResponseEnvelope {
  id: string;
  type: "response";
  ts?: string;
  timestamp?: number;
  status?: "ok" | "error";
  method?: string;
  correlation_id?: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  payload?: Record<string, unknown> | null;
}

export type Envelope = CommandEnvelope | EventEnvelope | ResponseEnvelope;

export type LocalBusEnvelope = {
  id: string;
  type: EnvelopeType;
  ts?: string;
  timestamp?: number;
  workspace_id?: string;
  session_id?: string;
  terminal_id?: string;
  lane_id?: string;
  correlation_id?: string;
  method?: string;
  topic?: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  status?: "ok" | "error";
  result?: Record<string, unknown> | null;
  error?: ErrorPayload | null;
};

// ---------------------------------------------------------------------------
// Discriminated envelope types for the typed bus (envelope.ts / bus consumers)
// ---------------------------------------------------------------------------

export interface CommandEnvelope {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "command";
  method: string;
  payload: unknown;
}

export interface ResponseEnvelope {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "response";
  method: string;
  payload: unknown;
  error?: BusError;
}

export interface EventEnvelope {
  id: string;
  correlation_id: string;
  timestamp: number;
  type: "event";
  topic: string;
  payload: unknown;
  sequence: number;
}

export type Envelope = CommandEnvelope | ResponseEnvelope | EventEnvelope;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isCommand(envelope: Envelope): envelope is CommandEnvelope {
  return envelope.type === "command";
}

export function isResponse(envelope: Envelope): envelope is ResponseEnvelope {
  return envelope.type === "response";
}

export function isEvent(envelope: Envelope): envelope is EventEnvelope {
  return envelope.type === "event";
}

// ---------------------------------------------------------------------------
// Protocol validation error
// ---------------------------------------------------------------------------

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
