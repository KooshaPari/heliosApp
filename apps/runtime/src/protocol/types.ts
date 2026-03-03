export type EnvelopeType = "command" | "response" | "event";

type OptionalString = string | undefined;
type OptionalRecord = Record<string, unknown> | undefined;

type CamelToSnake<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Head extends Lowercase<Head>
    ? `${Head}${CamelToSnake<Tail>}`
    : `_${Lowercase<Head>}${CamelToSnake<Tail>}`
  : S;

type SnakeCaseRecord<T extends Record<string, unknown>> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K];
};

export type ErrorPayload = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown> | null;
};

type LocalBusEnvelopeBase = {
  id: string;
  type: EnvelopeType;
  ts: string;
  timestamp?: OptionalString;
  correlationId?: OptionalString;
  workspaceId?: OptionalString;
  sessionId?: OptionalString;
  terminalId?: OptionalString;
  laneId?: OptionalString;
  method?: OptionalString;
  topic?: OptionalString;
  payload?: OptionalRecord | null;
  status?: "ok" | "error";
  result?: OptionalRecord | null;
  error?: ErrorPayload | null;
  sequence?: number;
  envelopeId?: OptionalString;
};

export type LocalBusEnvelope = SnakeCaseRecord<LocalBusEnvelopeBase>;

// ---------------------------------------------------------------------------
// Envelope types for the bus.ts / envelope.ts subsystem
// ---------------------------------------------------------------------------

export type BusError = {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
};

type CommandEnvelopeBase = {
  id: string;
  correlationId: string;
  timestamp: number;
  type: "command";
  method: string;
  payload: unknown;
  error?: BusError;
};

type ResponseEnvelopeBase = {
  id: string;
  correlationId: string;
  timestamp: number;
  type: "response";
  method: string;
  payload: unknown;
  error?: BusError;
};

type EventEnvelopeBase = {
  id: string;
  correlationId: string;
  timestamp: number;
  type: "event";
  topic: string;
  payload: unknown;
  sequence: number;
};

export type CommandEnvelope = SnakeCaseRecord<CommandEnvelopeBase>;
export type ResponseEnvelope = SnakeCaseRecord<ResponseEnvelopeBase>;
export type EventEnvelope = SnakeCaseRecord<EventEnvelopeBase>;

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
