import type { AuditEvent } from "./event.ts";
import type { AuditFilter } from "./ledger.ts";
import type { AuditLedger } from "./ledger.ts";

/**
 * API response wrapper for paginated results.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * API response for errors.
 */
export interface ErrorResponse {
  error: string;
  details?: string;
}

type ScalarOrArray = string | string[];
type QueryParams = {
  workspaceId?: ScalarOrArray;
  laneId?: ScalarOrArray;
  sessionId?: ScalarOrArray;
  actor?: ScalarOrArray;
  eventType?: ScalarOrArray;
  correlationId?: ScalarOrArray;
  from?: ScalarOrArray;
  to?: ScalarOrArray;
  limit?: ScalarOrArray;
  offset?: ScalarOrArray;
};

/**
 * Audit ledger HTTP API handler.
 * Provides endpoints for searching, filtering, and subscribing to audit events.
 */
export class AuditLedgerApi {
  private requestCounts: Map<string, number> = new Map();
  private requestResetTime: number = Date.now();
  private readonly rateLimit = 100; // 100 requests per minute
  private readonly rateLimitWindow = 60_000; // 1 minute

  constructor(private ledger: AuditLedger) {
    // Start rate limit reset timer
    setInterval(() => {
      this.requestCounts.clear();
      this.requestResetTime = Date.now();
    }, this.rateLimitWindow);
  }

  /**
   * GET /audit/events
   * Search for audit events with multi-dimensional filtering.
   */
  searchEvents(
    clientId: string,
    queryParams: QueryParams
  ): PaginatedResponse<AuditEvent> | ErrorResponse {
    if (!this.checkRateLimit(clientId)) {
      return {
        error: "Too many requests",
        details: "Rate limit exceeded: 100 requests per minute",
      };
    }

    try {
      const filter = this.parseAuditFilter(queryParams);
      const results = this.ledger.search(filter);
      const total = this.ledger.count(filter);

      return {
        data: results,
        total,
        limit: filter.limit || 100,
        offset: filter.offset || 0,
      };
    } catch (err) {
      return {
        error: "Invalid search parameters",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * GET /audit/events/:correlationId/chain
   * Get the complete correlation chain for a given ID.
   */
  getCorrelationChain(
    clientId: string,
    correlationId: string
  ): PaginatedResponse<AuditEvent> | ErrorResponse {
    if (!this.checkRateLimit(clientId)) {
      return {
        error: "Too many requests",
        details: "Rate limit exceeded: 100 requests per minute",
      };
    }

    try {
      if (!correlationId || typeof correlationId !== "string") {
        return {
          error: "Invalid correlation ID",
        };
      }

      const chain = this.ledger.getCorrelationChain(correlationId);

      return {
        data: chain,
        total: chain.length,
        limit: chain.length,
        offset: 0,
      };
    } catch (err) {
      return {
        error: "Error retrieving correlation chain",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * GET /audit/events/count
   * Count events matching a filter.
   */
  countEvents(clientId: string, queryParams: QueryParams): { count: number } | ErrorResponse {
    if (!this.checkRateLimit(clientId)) {
      return {
        error: "Too many requests",
        details: "Rate limit exceeded: 100 requests per minute",
      };
    }

    try {
      const filter = this.parseAuditFilter(queryParams);
      const count = this.ledger.count(filter);
      return { count };
    } catch (err) {
      return {
        error: "Invalid filter parameters",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Parse query parameters into an AuditFilter.
   */
  private parseAuditFilter(queryParams: QueryParams): AuditFilter {
    const filter: AuditFilter = {};

    this.assignSingleValue(queryParams.workspaceId, value => {
      filter.workspaceId = value;
    });
    this.assignSingleValue(queryParams.laneId, value => {
      filter.laneId = value;
    });
    this.assignSingleValue(queryParams.sessionId, value => {
      filter.sessionId = value;
    });
    this.assignSingleValue(queryParams.actor, value => {
      filter.actor = value;
    });
    this.assignSingleValue(queryParams.correlationId, value => {
      filter.correlationId = value;
    });

    if (queryParams.eventType) {
      filter.eventType = Array.isArray(queryParams.eventType)
        ? queryParams.eventType
        : [queryParams.eventType];
    }

    const fromRaw = this.firstValue(queryParams.from);
    const toRaw = this.firstValue(queryParams.to);
    if (fromRaw || toRaw) {
      const from = fromRaw ? new Date(fromRaw) : new Date(0);
      const to = toRaw ? new Date(toRaw) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new Error("Invalid time range parameters");
      }
      filter.timeRange = { from, to };
    }

    const limit = this.parsePositiveInt(queryParams.limit, "Limit", 1, 1000);
    if (limit !== undefined) {
      filter.limit = limit;
    }

    const offset = this.parseIntAtLeastZero(queryParams.offset, "Offset");
    if (offset !== undefined) {
      filter.offset = offset;
    }

    return filter;
  }

  private assignSingleValue(
    value: ScalarOrArray | undefined,
    assign: (value: string) => void
  ): void {
    const normalized = this.firstValue(value);
    if (normalized) {
      assign(normalized);
    }
  }

  private firstValue(value: ScalarOrArray | undefined): string | undefined {
    if (typeof value === "undefined") {
      return undefined;
    }
    return Array.isArray(value) ? value[0] : value;
  }

  private parsePositiveInt(
    rawValue: ScalarOrArray | undefined,
    label: string,
    min: number,
    max: number
  ): number | undefined {
    const stringValue = this.firstValue(rawValue);
    if (!stringValue) {
      return undefined;
    }

    const parsed = Number.parseInt(stringValue, 10);
    if (Number.isNaN(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be between ${min} and ${max}`);
    }

    return parsed;
  }

  private parseIntAtLeastZero(
    rawValue: ScalarOrArray | undefined,
    label: string
  ): number | undefined {
    const stringValue = this.firstValue(rawValue);
    if (!stringValue) {
      return undefined;
    }

    const parsed = Number.parseInt(stringValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error(`${label} must be >= 0`);
    }

    return parsed;
  }

  /**
   * Check and enforce rate limiting per client.
   */
  private checkRateLimit(clientId: string): boolean {
    const count = (this.requestCounts.get(clientId) || 0) + 1;
    this.requestCounts.set(clientId, count);

    return count <= this.rateLimit;
  }
}
