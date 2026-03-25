/**
 * Error taxonomy for the Helios bus subsystem.
 *
 * All bus failures are represented as structured BusError values.
 * Factory functions produce frozen (immutable) error objects and never throw.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Exhaustive set of bus error codes. */
export type BusErrorCode =
  | 'VALIDATION_ERROR'
  | 'METHOD_NOT_FOUND'
  | 'HANDLER_ERROR'
  | 'TIMEOUT'
  | 'BACKPRESSURE';

/** Structured error value carried in response envelopes. */
export interface BusError {
  readonly code: BusErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** Create a VALIDATION_ERROR for malformed envelopes or payloads. */
export function validationError(
  message: string,
  details?: Record<string, unknown> | null,
): Readonly<BusError> {
  return Object.freeze({ code: 'VALIDATION_ERROR' as const, message, retryable: false, details });
}

/** Create a METHOD_NOT_FOUND error when no handler is registered. */
export function methodNotFound(method: string): Readonly<BusError> {
  return Object.freeze({
    code: 'METHOD_NOT_FOUND' as const,
    message: `No handler registered for method: ${method}`,
    retryable: false,
  });
}

/** Create a HANDLER_ERROR when a command handler throws. */
export function handlerError(method: string, cause: unknown): Readonly<BusError> {
  // Sanitize: do not leak file-system paths from stack traces.
  const safeMessage =
    cause instanceof Error
      ? cause.message.replace(/\/[\w/.:-]+/g, '<path>')
      : String(cause);

  return Object.freeze({
    code: 'HANDLER_ERROR' as const,
    message: `Handler for "${method}" failed: ${safeMessage}`,
    retryable: false,
    details: cause instanceof Error ? { name: cause.name } : undefined,
  });
}

/** Create a TIMEOUT error when a command exceeds its deadline. */
export function timeoutError(method: string, timeoutMs: number): Readonly<BusError> {
  return Object.freeze({
    code: 'TIMEOUT' as const,
    message: `Method "${method}" timed out after ${timeoutMs}ms`,
    retryable: true,
  });
}

/** Create a BACKPRESSURE error when an event topic is saturated. */
export function backpressureError(topic: string): Readonly<BusError> {
  return Object.freeze({
    code: 'BACKPRESSURE' as const,
    message: `Backpressure on topic "${topic}": consumer cannot keep up`,
    retryable: true,
  });
}
