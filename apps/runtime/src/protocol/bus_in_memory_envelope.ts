import type { LocalBusEnvelope } from "./types.js";

export function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export function hasTopLevelDataField(envelope: LocalBusEnvelope): boolean {
  return Object.prototype.hasOwnProperty.call(envelope, "data");
}

export function buildOkResponse(
  _command: LocalBusEnvelope,
  result: Record<string, unknown>
): LocalBusEnvelope {
  return {
    id: `res-${Date.now()}`,
    type: "response",
    ts: new Date().toISOString(),
    status: "ok",
    result,
  };
}

export function buildErrorResponse(
  _command: LocalBusEnvelope,
  code: string,
  message: string
): LocalBusEnvelope {
  return {
    id: `res-${Date.now()}`,
    type: "response",
    ts: new Date().toISOString(),
    status: "error",
    error: {
      code,
      message,
      retryable: false,
    },
  };
}

export function buildMissingCorrelationResponse(method: string): LocalBusEnvelope {
  return {
    id: `res-${Date.now()}`,
    type: "response",
    ts: new Date().toISOString(),
    status: "error",
    error: {
      code: "MISSING_CORRELATION_ID",
      message: `correlation_id is required for ${method}`,
      retryable: false,
    },
  };
}

export function buildMethodNotSupportedResponse(command: LocalBusEnvelope): LocalBusEnvelope {
  return {
    id: command.id,
    type: "response",
    ts: new Date().toISOString(),
    status: "error",
    error: {
      code: "METHOD_NOT_SUPPORTED",
      message: `No handler registered for method: ${command.method ?? "unknown"}`,
      retryable: false,
    },
    result: {},
  };
}
