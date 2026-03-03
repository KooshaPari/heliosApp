import type { ErrorPayload } from "./types";

export const ERROR_CODES = {
  HARNESS_UNAVAILABLE: "HARNESS_UNAVAILABLE",
  LANE_NOT_FOUND: "LANE_NOT_FOUND",
  METHOD_NOT_SUPPORTED: "METHOD_NOT_SUPPORTED",
  RECOVERY_NOT_POSSIBLE: "RECOVERY_NOT_POSSIBLE",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  TERMINAL_NOT_FOUND: "TERMINAL_NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

type ErrorOptions = {
  details?: Record<string, unknown>;
  message?: string;
  retryable?: boolean;
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  HARNESS_UNAVAILABLE: "External harness is unavailable. Retry shortly or switch lanes.",
  LANE_NOT_FOUND: "Lane could not be found for this operation.",
  METHOD_NOT_SUPPORTED: "Requested method is not supported by the local runtime.",
  RECOVERY_NOT_POSSIBLE: "Recovery metadata is incomplete and cannot be reattached safely.",
  SESSION_NOT_FOUND: "Session could not be found for this operation.",
  TERMINAL_NOT_FOUND: "Terminal could not be found for this operation.",
  VALIDATION_FAILED: "Request validation failed."
};

export function createProtocolError(code: ErrorCode, options: ErrorOptions = {}): ErrorPayload {
  return {
    code,
    message: options.message ?? DEFAULT_MESSAGES[code],
    retryable: options.retryable ?? isRetryable(code),
    details: options.details ?? null
  };
}

function isRetryable(code: ErrorCode): boolean {
  return code === ERROR_CODES.HARNESS_UNAVAILABLE;
}
