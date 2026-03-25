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
<<<<<<< HEAD
  ts: string;
  timestamp?: string | number;
  correlation_id?: string;
=======
  ts?: string;
  timestamp?: number;
>>>>>>> origin/main
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
  sequence?: number;
};

export type CommandEnvelope = LocalBusEnvelope & {
  type: "command";
  method: string;
  payload: Record<string, unknown>;
};

export type ResponseEnvelope = LocalBusEnvelope & {
  type: "response";
  status: "ok" | "error";
};

export type EventEnvelope = LocalBusEnvelope & {
  type: "event";
  topic: string;
  payload: Record<string, unknown>;
};

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

export function isCommand(envelope: LocalBusEnvelope): envelope is CommandEnvelope {
  return envelope.type === "command" && typeof envelope.method === "string";
}

export function isResponse(envelope: LocalBusEnvelope): envelope is ResponseEnvelope {
  return envelope.type === "response" && (envelope.status === "ok" || envelope.status === "error");
}

export function isEvent(envelope: LocalBusEnvelope): envelope is EventEnvelope {
  return envelope.type === "event" && typeof envelope.topic === "string";
}
