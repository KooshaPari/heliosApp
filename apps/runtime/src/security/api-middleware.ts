import {
  sanitizeObject,
  sanitizeString,
  sanitizeTerminalInput,
  validateLaneId,
  validateSessionId,
  validateTerminalId,
  validateWorkspaceId,
} from "./input-sanitizer.js";
import { RateLimiter } from "./rate-limiter.js";

export const API_RATE_LIMITS = {
  protocol_dispatch: { windowMs: 60000, maxRequests: 200 },
  lane_create: { windowMs: 60000, maxRequests: 50 },
  session_attach: { windowMs: 60000, maxRequests: 50 },
  terminal_spawn: { windowMs: 60000, maxRequests: 100 },
  lane_cleanup: { windowMs: 60000, maxRequests: 30 },
  harness_status: { windowMs: 60000, maxRequests: 100 },
} as const;

export function createRateLimiters(): Record<string, RateLimiter> {
  const limiters: Record<string, RateLimiter> = {};
  for (const [endpoint, config] of Object.entries(API_RATE_LIMITS)) {
    limiters[endpoint] = new RateLimiter(config);
  }
  return limiters;
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function validateRequestIds(body: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (body.workspace_id && typeof body.workspace_id === "string") {
    if (!validateWorkspaceId(body.workspace_id)) {
      errors.push("Invalid workspace_id format");
    }
  }

  if (body.lane_id && typeof body.lane_id === "string") {
    if (!validateLaneId(body.lane_id)) {
      errors.push("Invalid lane_id format");
    }
  }

  if (body.session_id && typeof body.session_id === "string") {
    if (!validateSessionId(body.session_id)) {
      errors.push("Invalid session_id format");
    }
  }

  if (body.terminal_id && typeof body.terminal_id === "string") {
    if (!validateTerminalId(body.terminal_id)) {
      errors.push("Invalid terminal_id format");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeObject(body, {
    display_name: 100,
    title: 100,
    project_context_id: 100,
  });

  if (sanitized.data && typeof sanitized.data === "string") {
    sanitized.data = sanitizeTerminalInput(sanitized.data as string);
  }

  return sanitized;
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}
