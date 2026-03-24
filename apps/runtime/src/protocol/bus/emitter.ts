import type { LocalBusEnvelope } from "../types.js";
import type {
  LocalBus,
  AuditRecord,
  BusState,
  CommandBusOptions,
  CommandEnvelope,
  EventEnvelope,
  ResponseEnvelope,
  LocalBusEnvelopeWithSequence,
} from "./types.js";
import type { MethodHandler } from "../methods.js";
import { ProtocolValidationError } from "../types.js";
import { validateEnvelope } from "../validator.js";
import {
  TERMINAL_TOPICS,
  START_TOPICS,
  isTerminalTopic,
  isStartTopic,
  resolveExpectedStartTopic,
  publishLifecycleEvent,
} from "./lifecycle.js";
import { MetricsRecorder } from "./metrics.js";
import { isCommandEnvelope, isEventEnvelope, hasTopLevelDataField } from "./validation.js";

// ---------------------------------------------------------------------------
// InMemoryLocalBus — protocol lifecycle implementation
// ---------------------------------------------------------------------------

export class InMemoryLocalBus implements LocalBus {
  private readonly eventLog: LocalBusEnvelope[] = [];
  private readonly auditLog: AuditRecord[] = [];
  private readonly metricsRecorder: MetricsRecorder = new MetricsRecorder();
  private state: BusState = { session: "detached" };
  private readonly lifecycleProgress: Map<string, Set<string>> = new Map();
  private rendererEngine: "ghostty" | "rio" = "ghostty";

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
  }

  /**
   * Push an event directly to the event log without validation.
   * Used by HTTP routing layer for events that don't follow protocol lifecycle ordering.
   */
  pushEvent(event: LocalBusEnvelope): void {
    const sequencedEvent = event as LocalBusEnvelopeWithSequence;
    if (sequencedEvent.sequence === undefined) {
      sequencedEvent.sequence = this.getSequence() + 1;
    }
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  getAuditRecords(): Promise<AuditRecord[]> {
    return Promise.resolve([...this.auditLog]);
  }

  getMetricsReport() {
    return this.metricsRecorder.getMetricsReport();
  }

  getState(): BusState {
    return { ...this.state };
  }

  private getSequence(): number {
    return this.eventLog.filter(e => e.type === "event").length;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Publish behavior intentionally mirrors protocol lifecycle matrix.
  async publish(event: LocalBusEnvelope): Promise<void> {
    await Promise.resolve();
    // Validate the envelope
    try {
      validateEnvelope(event);
    } catch (err: unknown) {
      const auditErr = err instanceof ProtocolValidationError ? err.message : String(err);
      this.auditLog.push({ envelope: event, outcome: "rejected", error: auditErr });
      throw err;
    }

    // Check ordering: start topics must appear before terminal topics for same correlation
    const topic = event.topic;
    const correlationId = event.correlation_id ?? "";

    if (topic) {
      // Check if this topic is a non-start lifecycle topic that requires a prior start
      const isTerminal = isTerminalTopic(topic);
      const isStart = isStartTopic(topic);

      if (isStart) {
        // Record that this correlation has seen this start topic
        if (!this.lifecycleProgress.has(correlationId)) {
          this.lifecycleProgress.set(correlationId, new Set());
        }
        const progress = this.lifecycleProgress.get(correlationId);
        if (!progress) {
          throw new ProtocolValidationError(
            "ORDERING_VIOLATION",
            `Missing lifecycle progress for correlation "${correlationId}"`
          );
        }
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

      if (isTerminal) {
        // For terminal topics, there must be a corresponding start topic for this correlation
        const seen = this.lifecycleProgress.get(correlationId);
        const expectedStart = resolveExpectedStartTopic(topic);

        if (!seen?.has(expectedStart) && expectedStart !== topic) {
          const err = new ProtocolValidationError(
            "ORDERING_VIOLATION",
            `Topic '${topic}' cannot be published before '${expectedStart}'`
          );
          this.auditLog.push({ envelope: event, outcome: "rejected", error: err.message });
          throw err;
        
        // Clear lifecycle progress after successful terminal topic to allow re-use
        this.lifecycleProgress.delete(correlationId);
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
        this.metricsRecorder.recordMetric(
          "terminal_output_backlog_depth",
          backlogDepth,
          Object.keys(tags).length > 0 ? tags : undefined
        );
        this.metricsRecorder.emitMetricEvent(
          "terminal_output_backlog_depth",
          backlogDepth,
          this.eventLog,
          this.auditLog
        );
      }
    }

    // Assign sequence if not already set
    const sequencedEvent = event as LocalBusEnvelopeWithSequence;
    if (sequencedEvent.sequence === undefined) {
      sequencedEvent.sequence = this.getSequence() + 1;
    }
    this.auditLog.push({ envelope: event, outcome: "accepted" });
    this.eventLog.push(event);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Request semantics require explicit branch coverage.
  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    await Promise.resolve();
    // Validate correlation_id for lifecycle commands
    if (command.method) {
      const needsCorrelation = [
        "lane.create",
        "lane.attach",
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
        return this.handleLaneCreate(command, startTime);
      }

      if (command.method === "lane.attach") {
        return this.handleLaneAttach(command);
      }

      if (command.method === "session.attach") {
        return this.handleSessionAttach(command, startTime);
      }

      if (command.method === "terminal.spawn") {
        return this.handleTerminalSpawn(command, startTime);
      }

      if (command.method === "terminal.input") {
        return this.handleTerminalInput(command);
      }

      if (command.method === "renderer.capabilities") {
        return this.handleRendererCapabilities();
      }

      if (command.method === "renderer.switch") {
        return this.handleRendererSwitch(command);
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

  private handleLaneAttach(command: LocalBusEnvelope): LocalBusEnvelope {
    const correlationId = command.correlation_id ?? "";
    if (!this.lifecycleProgress.has(correlationId)) {
      this.lifecycleProgress.set(correlationId, new Set());
    }
    this.lifecycleProgress.get(correlationId)?.add("lane.attach.started");
    publishLifecycleEvent("lane.attach.started", command, this.eventLog, this.auditLog);

    const laneId = command.lane_id ?? command.payload?.lane_id ?? `lane_${Date.now()}`;

    this.lifecycleProgress.get(correlationId)?.add("lane.attached");
    publishLifecycleEvent("lane.attached", command, this.eventLog, this.auditLog);

    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        lane_id: laneId,
      },
    };
  }

  private handleLaneCreate(command: LocalBusEnvelope, startTime: number): LocalBusEnvelope {
    const correlationId = command.correlation_id;
    if (!correlationId) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: {
          code: "MISSING_CORRELATION_ID",
          message: "correlation_id is required for lane.create",
          retryable: false,
        },
      };
    }
    if (!this.lifecycleProgress.has(correlationId)) {
      this.lifecycleProgress.set(correlationId, new Set());
    }
    this.lifecycleProgress.get(correlationId)?.add("lane.create.started");
    publishLifecycleEvent("lane.create.started", command, this.eventLog, this.auditLog);
    publishLifecycleEvent("lane.created", command, this.eventLog, this.auditLog);
    this.metricsRecorder.recordMetric("lane_create_latency_ms", Date.now() - startTime);
    this.metricsRecorder.emitMetricEvent(
      "lane_create_latency_ms",
      Date.now() - startTime,
      this.eventLog,
      this.auditLog
    );
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
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        lane_id: resultId,
        state: this.state,
        diagnostics: {
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          preferred_transport: preferredTransport,
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          resolved_transport: resolvedTransport,
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_reason: degradedReason,
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_at: degraded ? new Date().toISOString() : null,
        },
      },
    };
  }

  private handleSessionAttach(command: LocalBusEnvelope, startTime: number): LocalBusEnvelope {
    const correlationId = command.correlation_id;
    if (!correlationId) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: {
          code: "MISSING_CORRELATION_ID",
          message: "correlation_id is required for session.attach",
          retryable: false,
        },
      };
    }
    const forceError = command.payload?.force_error === true;

    if (!this.lifecycleProgress.has(correlationId)) {
      this.lifecycleProgress.set(correlationId, new Set());
    }
    this.lifecycleProgress.get(correlationId)?.add("session.attach.started");
    publishLifecycleEvent("session.attach.started", command, this.eventLog, this.auditLog);

    if (forceError) {
      this.lifecycleProgress.get(correlationId)?.add("session.attach.failed");
      publishLifecycleEvent("session.attach.failed", command, this.eventLog, this.auditLog);
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
      publishLifecycleEvent("session.restore.started", command, this.eventLog, this.auditLog);
      this.metricsRecorder.recordMetric("session_restore_latency_ms", Date.now() - restoreStart);
      this.metricsRecorder.emitMetricEvent(
        "session_restore_latency_ms",
        Date.now() - restoreStart,
        this.eventLog,
        this.auditLog
      );
    }

    this.lifecycleProgress.get(correlationId)?.add("session.attached");
    publishLifecycleEvent("session.attached", command, this.eventLog, this.auditLog);
    if (isRestore) {
      publishLifecycleEvent("session.restore.completed", command, this.eventLog, this.auditLog);
    }
    this.state = { session: "attached" };
    const sessionResultId =
      command.session_id ?? command.payload?.id ?? command.payload?.session_id ?? `session_${Date.now()}`;
    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        session_id: sessionResultId,
        state: this.state,
        diagnostics: {
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          preferred_transport: "cliproxy_harness",
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          resolved_transport: "cliproxy_harness",
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_reason: null,
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_at: null,
        },
      },
    };
  }

  private handleTerminalSpawn(command: LocalBusEnvelope, startTime: number): LocalBusEnvelope {
    const correlationId = command.correlation_id;
    if (!correlationId) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: {
          code: "MISSING_CORRELATION_ID",
          message: "correlation_id is required for terminal.spawn",
          retryable: false,
        },
      };
    }
    const forceError = command.payload?.force_error === true;

    if (!this.lifecycleProgress.has(correlationId)) {
      this.lifecycleProgress.set(correlationId, new Set());
    }
    this.lifecycleProgress.get(correlationId)?.add("terminal.spawn.started");
    publishLifecycleEvent("terminal.spawn.started", command, this.eventLog, this.auditLog);

    if (forceError) {
      this.lifecycleProgress.get(correlationId)?.add("terminal.spawn.failed");
      publishLifecycleEvent("terminal.spawn.failed", command, this.eventLog, this.auditLog);
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: { code: "TERMINAL_SPAWN_FAILED", message: "forced error", retryable: false },
      };
    }

    // Emit state change events before final spawned event
    publishLifecycleEvent("terminal.state.changed", command, this.eventLog, this.auditLog);
    this.state = { ...this.state, terminal: "active" };
    publishLifecycleEvent("terminal.state.changed", command, this.eventLog, this.auditLog);
    this.lifecycleProgress.get(correlationId)?.add("terminal.spawned");
    publishLifecycleEvent("terminal.spawned", command, this.eventLog, this.auditLog);
    const terminalResultId =
      command.payload?.id ?? command.payload?.terminal_id ?? `terminal_${Date.now()}`;
    this.metricsRecorder.recordMetric("terminal_spawn_latency_ms", Date.now() - startTime);
    this.metricsRecorder.emitMetricEvent(
      "terminal_spawn_latency_ms",
      Date.now() - startTime,
      this.eventLog,
      this.auditLog
    );
    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        terminal_id: terminalResultId,
        state: this.state,
        diagnostics: {
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          preferred_transport: "cliproxy_harness",
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          resolved_transport: "cliproxy_harness",
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_reason: null,
          // biome-ignore lint/style/useNamingConvention: Protocol diagnostics fields use snake_case.
          degraded_at: null,
        },
      },
    };
  }

  private handleTerminalInput(command: LocalBusEnvelope): LocalBusEnvelope {
    // Validate data field
    if (
      command.payload?.data === undefined &&
      !hasTopLevelDataField(command as Record<string, unknown>)
    ) {
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

  private handleRendererCapabilities(): LocalBusEnvelope {
    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        active_engine: this.rendererEngine ?? "ghostty",
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        available_engines: ["ghostty", "rio"],
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        hot_swap_supported: true,
      },
    };
  }

  private handleRendererSwitch(command: LocalBusEnvelope): LocalBusEnvelope {
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
          // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
          active_engine: previousEngine,
          // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
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
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        active_engine: this.rendererEngine,
        // biome-ignore lint/style/useNamingConvention: Protocol response fields use snake_case.
        previous_engine: previousEngine,
      },
    };
  }

  // Implement LocalBus interface (stub methods - may be removed if not used)
  registerMethod(method: string, handler: MethodHandler): void {
    // Stub for interface compliance
  }

  async send(envelope: unknown): Promise<ResponseEnvelope> {
    // Stub for interface compliance
    return { id: "stub", type: "response", ts: new Date().toISOString(), status: "ok" };
  }

  subscribe(topic: string, handler: (evt: EventEnvelope) => void | Promise<void>): () => void {
    // Stub for interface compliance
    return () => {};
  }

  destroy(): void {
    // Stub for interface compliance
  }

  getActiveCorrelationId(): string | undefined {
    // Stub for interface compliance
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// CommandBusImpl — used by bus.test.ts and topics.test.ts via createBus()
// ---------------------------------------------------------------------------

function makeErrorResponse(
  _id: string,
  correlationId: string,
  method: string,
  code: string,
  message: string
): ResponseEnvelope {
  return {
    id: `res_${Date.now()}`,
    // biome-ignore lint/style/useNamingConvention: Protocol field names intentionally use snake_case.
    correlation_id: correlationId,
    ts: new Date().toISOString(),
    type: "response",
    status: "error",
    method,
    payload: null,
    error: { code, message },
  };
}

export class CommandBusImpl implements LocalBus {
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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Command dispatch intentionally models protocol branching in one place.
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
      const result = await handler(cmd as unknown as import("../types.js").CommandEnvelope);
      // Validate result is a response envelope
      if (
        !result ||
        typeof result !== "object" ||
        (result as unknown as Record<string, unknown>)["type"] !== "response"
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
      (event as unknown as Record<string, unknown>)["correlation_id"] = this.activeCorrelationId;
    }

    const topic = event.topic;

    // Assign per-topic sequence number
    const currentSeq = this.topicSequenceCounters.get(topic) ?? 0;
    const nextSeq = currentSeq + 1;
    this.topicSequenceCounters.set(topic, nextSeq);
    (event as unknown as Record<string, unknown>)["sequence"] = nextSeq;
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

  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    const response = await this.send(command);
    return response as unknown as LocalBusEnvelope;
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
