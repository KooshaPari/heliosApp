import type { LocalBusEnvelope } from "./types.js";
import type { CommandEnvelope, EventEnvelope, ResponseEnvelope } from "./types.js";
import { ProtocolValidationError } from "./types.js";
import { validateEnvelope } from "./validator.js";

// ---------------------------------------------------------------------------
// Protocol-level bus interface (used by InMemoryLocalBus for lifecycle commands)
// ---------------------------------------------------------------------------

export interface ProtocolBus {
  publish(event: LocalBusEnvelope): Promise<void>;
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
}

// ---------------------------------------------------------------------------
// Audit record (for protocol_bus tests)
// ---------------------------------------------------------------------------

export type AuditRecord = {
  envelope: LocalBusEnvelope;
  outcome: "accepted" | "rejected";
  error?: string;
};

// ---------------------------------------------------------------------------
// Metrics report (for runtime_metrics tests)
// ---------------------------------------------------------------------------

export type MetricSample = {
  metric: string;
  value: number;
  tags?: Record<string, string>;
};

export type MetricSummary = {
  metric: string;
  count: number;
  latest?: number;
  p95?: number;
  p99?: number;
  min?: number;
  max?: number;
};

export type MetricsReport = {
  summaries: MetricSummary[];
  samples?: MetricSample[];
};

// ---------------------------------------------------------------------------
// State (for protocol_bus tests)
// ---------------------------------------------------------------------------

export type BusState = {
  session: "attached" | "detached";
  terminal?: "active" | "inactive";
};

// ---------------------------------------------------------------------------
// InMemoryLocalBus — protocol lifecycle implementation
// ---------------------------------------------------------------------------

// Lifecycle state machine: track per-lane/session/correlation lifecycle ordering.
const _LIFECYCLE_SEQUENCES: Record<string, string[]> = {
  "session.attach": ["session.attach.started", "session.attached", "session.attach.failed"],
  "lane.create": ["lane.create.started", "lane.created", "lane.create.failed"],
  "terminal.spawn": ["terminal.spawn.started", "terminal.spawned", "terminal.spawn.failed"],
};

// Topics that are terminal within a lifecycle (end the sequence)
const TERMINAL_TOPICS = new Set([
  "session.attached",
  "session.attach.failed",
  "lane.created",
  "lane.create.failed",
  "terminal.spawned",
  "terminal.spawn.failed",
]);

// Topics that are start topics for their sequence
const START_TOPICS = new Set([
  "session.attach.started",
  "lane.create.started",
  "terminal.spawn.started",
]);

export class InMemoryLocalBus implements ProtocolBus {
  private readonly eventLog: LocalBusEnvelope[] = [];
  private readonly auditLog: AuditRecord[] = [];
  private readonly metricsAccumulator: Map<
    string,
    { count: number; latest?: number; values: number[] }
  > = new Map();
  private readonly metricSamples: MetricSample[] = [];
  private state: BusState = { session: "detached" };
  // Track which correlation IDs have seen which start topics
  private readonly lifecycleProgress: Map<string, Set<string>> = new Map();

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
  }

  /**
   * Push an event directly to the event log without validation.
   * Used by HTTP routing layer for events that don't follow protocol lifecycle ordering.
   */
  pushEvent(event: LocalBusEnvelope): void {
    if ((event as any).sequence === undefined) {
      (event as any).sequence = this.getSequence() + 1;
    }
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  async getAuditRecords(): Promise<AuditRecord[]> {
    return [...this.auditLog];
  }

  getMetricsReport(): MetricsReport {
    const summaries: MetricSummary[] = [];
    for (const [metric, data] of this.metricsAccumulator) {
      const summary: MetricSummary = {
        metric,
        count: data.count,
        ...(data.latest !== undefined ? { latest: data.latest } : {}),
      };
      if (data.values.length > 0) {
        const sorted = [...data.values].sort((a, b) => a - b);
        const p95Idx = Math.ceil(0.95 * sorted.length) - 1;
        const p99Idx = Math.ceil(0.99 * sorted.length) - 1;
        summary.p95 = sorted[Math.max(0, p95Idx)];
        summary.p99 = sorted[Math.max(0, p99Idx)];
        summary.min = sorted[0];
        summary.max = sorted[sorted.length - 1];
      }
      summaries.push(summary);
    }
    return { summaries, samples: [...this.metricSamples] };
  }

  getState(): BusState {
    return { ...this.state };
  }

  private recordMetric(metric: string, value?: number, tags?: Record<string, string>): void {
    const existing = this.metricsAccumulator.get(metric) ?? { count: 0, values: [] };
    const latestValue = value !== undefined ? value : existing.latest;
    const updated = {
      count: existing.count + 1,
      ...(latestValue !== undefined ? { latest: latestValue } : {}),
      values: existing.values,
    };
    if (value !== undefined) {
      updated.values.push(value);
    }
    this.metricsAccumulator.set(metric, updated);
    if (value !== undefined) {
      this.metricSamples.push({ metric, value, ...(tags !== undefined ? { tags } : {}) });
    }
  }

  private emitMetricEvent(metric: string, value?: number): void {
    const seq = this.getSequence() + 1;
    const event: LocalBusEnvelope = {
      id: `metric-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "diagnostics.metric",
      payload: { metric, value },
      sequence: seq,
    };
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  private getSequence(): number {
    return this.eventLog.filter(e => e.type === "event").length;
  }

  private publishLifecycleEvent(topic: string, envelope: LocalBusEnvelope): void {
    const seq = this.getSequence() + 1;
    const event: LocalBusEnvelope = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      ...(envelope.workspace_id !== undefined ? { workspace_id: envelope.workspace_id } : {}),
      ...(envelope.lane_id !== undefined ? { lane_id: envelope.lane_id } : {}),
      ...(envelope.session_id !== undefined ? { session_id: envelope.session_id } : {}),
      ...(envelope.terminal_id !== undefined ? { terminal_id: envelope.terminal_id } : {}),
      ...(envelope.correlation_id !== undefined ? { correlation_id: envelope.correlation_id } : {}),
      payload: {},
      sequence: seq,
    };
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  async publish(event: LocalBusEnvelope): Promise<void> {
    // Validate the envelope
    try {
      validateEnvelope(event);
    } catch (err) {
      const auditErr = err instanceof ProtocolValidationError ? err.message : String(err);
      this.auditLog.push({ envelope: event, outcome: "rejected", error: auditErr });
      throw err;
    }

    // Check ordering: start topics must appear before terminal topics for same correlation
    const topic = event.topic;
    const correlationId = event.correlation_id ?? "";

    if (topic) {
      // Check if this topic is a non-start lifecycle topic that requires a prior start
      const isTerminalTopic = TERMINAL_TOPICS.has(topic);
      const isStartTopic = START_TOPICS.has(topic);

      if (isStartTopic) {
        // Record that this correlation has seen this start topic
        if (!this.lifecycleProgress.has(correlationId)) {
          this.lifecycleProgress.set(correlationId, new Set());
        }
        const progress = this.lifecycleProgress.get(correlationId)!;
        if (progress.has(topic)) {
          // Duplicate start topic on same correlation — ordering violation
          const err = new ProtocolValidationError(
            "ORDERING_VIOLATION",
            `Duplicate start topic "${topic}" for correlation "${correlationId}"`
          );
          this.auditLog.push({ envelope: event, outcome: "rejected", error: err.message });
          throw err;
        }
        progress.add(topic);
        this.auditLog.push({ envelope: event, outcome: "accepted" });
        this.eventLog.push(event);
        return;
      }

      if (isTerminalTopic) {
        // For terminal topics, there must be a corresponding start topic for this correlation
        const seen = this.lifecycleProgress.get(correlationId);
        const expectedStart = topic
          .replace(".attached", ".attach.started")
          .replace(
            ".failed",
            topic.includes("attach")
              ? ".attach.started"
              : topic.includes("create")
                ? ".create.started"
                : topic.includes("spawn")
                  ? ".spawn.started"
                  : ""
          )
          .replace(".created", ".create.started")
          .replace(".spawned", ".spawn.started");

        if (!seen?.has(expectedStart) && expectedStart !== topic) {
          const err = new ProtocolValidationError(
            "ORDERING_VIOLATION",
            `Topic '${topic}' cannot be published before '${expectedStart}'`
          );
          this.auditLog.push({ envelope: event, outcome: "rejected", error: err.message });
          throw err;
        }
      }

      // Handle terminal.output metrics
      if (topic === "terminal.output") {
        const backlogDepth =
          typeof event.payload?.backlog_depth === "number"
            ? event.payload.backlog_depth
            : undefined;
        const tags: Record<string, string> = {};
        if (event.session_id) {
          tags.session_id = event.session_id;
        }
        if (event.lane_id) {
          tags.lane_id = event.lane_id;
        }
        if (event.terminal_id) {
          tags.terminal_id = event.terminal_id;
        }
        this.recordMetric(
          "terminal_output_backlog_depth",
          backlogDepth,
          Object.keys(tags).length > 0 ? tags : undefined
        );
        this.emitMetricEvent("terminal_output_backlog_depth", backlogDepth);
      }
    }

    // Assign sequence if not already set
    if ((event as any).sequence === undefined) {
      (event as any).sequence = this.getSequence() + 1;
    }
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    // Validate correlation_id for lifecycle commands
    if (command.method) {
      const needsCorrelation = [
        "lane.create",
        "session.attach",
        "terminal.spawn",
        "terminal.input",
        "terminal.resize",
      ];
      if (needsCorrelation.includes(command.method) && !command.correlation_id) {
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "error",
          error: {
            code: "MISSING_CORRELATION_ID",
            message: "correlation_id is required",
            retryable: false,
          },
        };
      }

      const startTime = Date.now();

      if (command.method === "lane.create") {
        const correlationId = command.correlation_id!;
        if (!this.lifecycleProgress.has(correlationId)) {
          this.lifecycleProgress.set(correlationId, new Set());
        }
        this.lifecycleProgress.get(correlationId)?.add("lane.create.started");
        this.publishLifecycleEvent("lane.create.started", command);
        this.publishLifecycleEvent("lane.created", command);
        this.recordMetric("lane_create_latency_ms", Date.now() - startTime);
        this.emitMetricEvent("lane_create_latency_ms", Date.now() - startTime);
        const resultId = command.payload?.id ?? command.payload?.lane_id ?? `lane_${Date.now()}`;
        const preferredTransport =
          typeof command.payload?.preferred_transport === "string"
            ? command.payload.preferred_transport
            : "cliproxy_harness";
        const degraded = command.payload?.simulate_degrade === true;
        const resolvedTransport = degraded ? "native_openai" : preferredTransport;
        const degradedReason = degraded ? "cliproxy_harness_unhealthy" : null;
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {
            lane_id: resultId,
            state: this.state,
            diagnostics: {
              preferred_transport: preferredTransport,
              resolved_transport: resolvedTransport,
              degraded_reason: degradedReason,
              degraded_at: degraded ? new Date().toISOString() : null,
            },
          },
        };
      }

      if (command.method === "session.attach") {
        const correlationId = command.correlation_id!;
        const forceError = command.payload?.force_error === true;

        if (!this.lifecycleProgress.has(correlationId)) {
          this.lifecycleProgress.set(correlationId, new Set());
        }
        this.lifecycleProgress.get(correlationId)?.add("session.attach.started");
        this.publishLifecycleEvent("session.attach.started", command);

        if (forceError) {
          this.lifecycleProgress.get(correlationId)?.add("session.attach.failed");
          this.publishLifecycleEvent("session.attach.failed", command);
          this.state = { session: "detached" };
          return {
            id: `res-${Date.now()}`,
            type: "response",
            ts: new Date().toISOString(),
            status: "error",
            error: { code: "SESSION_ATTACH_FAILED", message: "forced error", retryable: false },
          };
        }

        const isRestore = command.payload?.restore === true;
        if (isRestore) {
          const restoreStart = Date.now();
          this.recordMetric("session_restore_latency_ms", Date.now() - restoreStart);
          this.emitMetricEvent("session_restore_latency_ms", Date.now() - restoreStart);
        }

        this.lifecycleProgress.get(correlationId)?.add("session.attached");
        this.publishLifecycleEvent("session.attached", command);
        this.state = { session: "attached" };
        const sessionResultId =
          command.payload?.id ?? command.payload?.session_id ?? `session_${Date.now()}`;
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {
            session_id: sessionResultId,
            state: this.state,
            diagnostics: {
              preferred_transport: "cliproxy_harness",
              resolved_transport: "cliproxy_harness",
              degraded_reason: null,
              degraded_at: null,
            },
          },
        };
      }

      if (command.method === "terminal.spawn") {
        const correlationId = command.correlation_id!;
        const forceError = command.payload?.force_error === true;

        if (!this.lifecycleProgress.has(correlationId)) {
          this.lifecycleProgress.set(correlationId, new Set());
        }
        this.lifecycleProgress.get(correlationId)?.add("terminal.spawn.started");
        this.publishLifecycleEvent("terminal.spawn.started", command);

        if (forceError) {
          this.lifecycleProgress.get(correlationId)?.add("terminal.spawn.failed");
          this.publishLifecycleEvent("terminal.spawn.failed", command);
          return {
            id: `res-${Date.now()}`,
            type: "response",
            ts: new Date().toISOString(),
            status: "error",
            error: { code: "TERMINAL_SPAWN_FAILED", message: "forced error", retryable: false },
          };
        }

        // Emit state change events before final spawned event
        this.publishLifecycleEvent("terminal.state.changed", command);
        this.state = { ...this.state, terminal: "active" };
        this.publishLifecycleEvent("terminal.state.changed", command);
        this.lifecycleProgress.get(correlationId)?.add("terminal.spawned");
        this.publishLifecycleEvent("terminal.spawned", command);
        const terminalResultId =
          command.payload?.id ?? command.payload?.terminal_id ?? `terminal_${Date.now()}`;
        this.recordMetric("terminal_spawn_latency_ms", Date.now() - startTime);
        this.emitMetricEvent("terminal_spawn_latency_ms", Date.now() - startTime);
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {
            terminal_id: terminalResultId,
            state: this.state,
            diagnostics: {
              preferred_transport: "cliproxy_harness",
              resolved_transport: "cliproxy_harness",
              degraded_reason: null,
              degraded_at: null,
            },
          },
        };
      }

      if (command.method === "terminal.input") {
        // Validate data field
        if (command.payload?.data === undefined && !("data" in (command as any))) {
          return {
            id: `res-${Date.now()}`,
            type: "response",
            ts: new Date().toISOString(),
            status: "error",
            error: {
              code: "INVALID_TERMINAL_INPUT",
              message: "payload.data is required",
              retryable: false,
            },
          };
        }

        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {},
        };
      }

      if (command.method === "renderer.capabilities") {
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {
            active_engine: this.rendererEngine ?? "ghostty",
            available_engines: ["ghostty", "rio"],
            hot_swap_supported: true,
          },
        };
      }

      if (command.method === "renderer.switch") {
        const nextEngine = command.payload?.target_engine;
        const forceError = command.payload?.force_error === true;
        const previousEngine = this.rendererEngine ?? "ghostty";

        if (forceError) {
          return {
            id: `res-${Date.now()}`,
            type: "response",
            ts: new Date().toISOString(),
            status: "error",
            error: { code: "RENDERER_SWITCH_FAILED", message: "forced error", retryable: false },
            result: {
              active_engine: previousEngine,
              previous_engine: previousEngine,
            },
          };
        }

        this.rendererEngine = nextEngine === "rio" ? "rio" : "ghostty";
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "ok",
          result: {
            active_engine: this.rendererEngine,
            previous_engine: previousEngine,
          },
        };
      }
    }

    return {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {},
    };
  }

  private rendererEngine: "ghostty" | "rio" = "ghostty";
}

// ---------------------------------------------------------------------------
// CommandBus — used by bus.test.ts and topics.test.ts via createBus()
// ---------------------------------------------------------------------------

import type { MethodHandler } from "./methods.js";

export type CommandBusOptions = {
  maxDepth?: number;
};

export interface LocalBus {
  registerMethod(method: string, handler: MethodHandler): void;
  send(envelope: unknown): Promise<ResponseEnvelope>;
  subscribe(topic: string, handler: (evt: EventEnvelope) => void | Promise<void>): () => void;
  publish(evt: unknown): Promise<void>;
  destroy(): void;
  getActiveCorrelationId(): string | undefined;
}

function makeErrorResponse(
  _id: string,
  correlationId: string,
  method: string,
  code: string,
  message: string
): ResponseEnvelope {
  return {
    id: `res_${Date.now()}`,
    correlation_id: correlationId,
    timestamp: performance.now(),
    type: "response",
    method,
    payload: null,
    error: { code, message },
  };
}

function isCommandEnvelope(val: unknown): val is CommandEnvelope {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as Record<string, unknown>).type === "command" &&
    typeof (val as Record<string, unknown>).method === "string" &&
    typeof (val as Record<string, unknown>).id === "string" &&
    "payload" in (val as Record<string, unknown>)
  );
}

function isEventEnvelope(val: unknown): val is EventEnvelope {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as Record<string, unknown>).type === "event" &&
    typeof (val as Record<string, unknown>).topic === "string"
  );
}

class CommandBusImpl implements LocalBus {
  private readonly methods = new Map<string, MethodHandler>();
  private readonly subscribers = new Map<
    string,
    Array<{ handler: (evt: EventEnvelope) => void | Promise<void>; removed: boolean }>
  >();
  private readonly options: Required<CommandBusOptions>;
  private destroyed = false;
  private activeCorrelationId: string | undefined = undefined;
  private currentDepth = 0;
  private topicSequenceCounters = new Map<string, number>();

  constructor(options: CommandBusOptions = {}) {
    this.options = { maxDepth: options.maxDepth ?? 10 };
  }

  registerMethod(method: string, handler: MethodHandler): void {
    this.methods.set(method, handler);
  }

  async send(envelope: unknown): Promise<ResponseEnvelope> {
    // Guard destroyed state
    if (this.destroyed) {
      const id =
        typeof (envelope as Record<string, unknown>)?.id === "string"
          ? ((envelope as Record<string, unknown>).id as string)
          : "unknown";
      const corr =
        typeof (envelope as Record<string, unknown>)?.correlation_id === "string"
          ? ((envelope as Record<string, unknown>).correlation_id as string)
          : "unknown";
      return makeErrorResponse(id, corr, "", "VALIDATION_ERROR", "Bus is destroyed");
    }

    // Validate envelope shape
    if (!isCommandEnvelope(envelope)) {
      const id =
        typeof (envelope as Record<string, unknown>)?.id === "string"
          ? ((envelope as Record<string, unknown>).id as string)
          : "unknown";
      const corr =
        typeof (envelope as Record<string, unknown>)?.correlation_id === "string"
          ? ((envelope as Record<string, unknown>).correlation_id as string)
          : "unknown";
      const type = (envelope as Record<string, unknown>)?.type;
      if (type === "event" || type === "response") {
        return makeErrorResponse(id, corr, "", "VALIDATION_ERROR", "Expected a command envelope");
      }
      return makeErrorResponse(id, corr, "", "VALIDATION_ERROR", "Malformed envelope");
    }

    const cmd = envelope as CommandEnvelope;

    // Depth guard
    if (this.currentDepth >= this.options.maxDepth) {
      return makeErrorResponse(
        cmd.id,
        cmd.correlation_id,
        cmd.method,
        "HANDLER_ERROR",
        `Re-entrant depth limit exceeded (max ${this.options.maxDepth})`
      );
    }

    const handler = this.methods.get(cmd.method);
    if (!handler) {
      return makeErrorResponse(
        cmd.id,
        cmd.correlation_id,
        cmd.method,
        "METHOD_NOT_FOUND",
        `No handler registered for method: ${cmd.method}`
      );
    }

    // Execute handler
    const prevCorrelation = this.activeCorrelationId;
    this.activeCorrelationId = cmd.correlation_id;
    this.currentDepth++;

    try {
      const result = await handler(cmd);
      // Validate result is a response envelope
      if (
        !result ||
        typeof result !== "object" ||
        (result as Record<string, unknown>).type !== "response"
      ) {
        return makeErrorResponse(
          cmd.id,
          cmd.correlation_id,
          cmd.method,
          "HANDLER_ERROR",
          `Handler for "${cmd.method}" returned non-envelope value`
        );
      }
      return result as ResponseEnvelope;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message.replace(/\/[\w/.:-]+/g, "<path>") : String(err);
      return makeErrorResponse(
        cmd.id,
        cmd.correlation_id,
        cmd.method,
        "HANDLER_ERROR",
        `Handler for "${cmd.method}" failed: ${msg}`
      );
    } finally {
      this.currentDepth--;
      this.activeCorrelationId = prevCorrelation;
    }
  }

  subscribe(topic: string, handler: (evt: EventEnvelope) => void | Promise<void>): () => void {
    let list = this.subscribers.get(topic);
    if (!list) {
      list = [];
      this.subscribers.set(topic, list);
    }
    const entry = { handler, removed: false };
    list.push(entry);
    return () => {
      entry.removed = true;
      const current = this.subscribers.get(topic);
      if (current) {
        const idx = current.indexOf(entry);
        if (idx !== -1) {
          current.splice(idx, 1);
        }
        if (current.length === 0) {
          this.subscribers.delete(topic);
        }
      }
    };
  }

  async publish(evt: unknown): Promise<void> {
    if (this.destroyed) {
      return;
    }

    // Silently discard invalid envelopes (per FR-009)
    if (!isEventEnvelope(evt)) {
      return;
    }

    const event = evt as EventEnvelope;

    // Inject active correlation_id from command context (FR-008)
    if (this.activeCorrelationId) {
      (event as Record<string, unknown>).correlation_id = this.activeCorrelationId;
    }

    const topic = event.topic;

    // Assign per-topic sequence number
    const currentSeq = this.topicSequenceCounters.get(topic) ?? 0;
    const nextSeq = currentSeq + 1;
    this.topicSequenceCounters.set(topic, nextSeq);
    (event as Record<string, unknown>).sequence = nextSeq;
    const list = this.subscribers.get(topic);
    if (!list) {
      return;
    }

    // Snapshot before iteration (FR-010)
    // Clone handler references so unsubscribe during iteration does not affect delivery
    const snapshot = list.map(entry => entry.handler);
    for (const handler of snapshot) {
      try {
        await handler(event);
      } catch {
        // FR-009: subscriber isolation — errors are silently swallowed
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.methods.clear();
    this.subscribers.clear();
  }

  getActiveCorrelationId(): string | undefined {
    return this.activeCorrelationId;
  }
}

export function createBus(options?: CommandBusOptions): LocalBus {
  return new CommandBusImpl(options);
}
