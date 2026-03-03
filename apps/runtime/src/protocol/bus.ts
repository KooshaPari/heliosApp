import { InMemoryAuditSink, type AuditRecord, type AuditSink } from "../audit/sink";
import {
  INITIAL_RUNTIME_STATE,
  transition,
  type RuntimeEvent,
  type RuntimeState
} from "../sessions/state_machine";
import { TerminalOutputBuffer } from "../sessions/terminal_buffer";
import type { TerminalContext, TerminalLifecycleState } from "../sessions/terminal_registry";
import { TerminalRegistry } from "../sessions/terminal_registry";
import {
  RuntimeMetrics,
  type RuntimeMetricSample,
  type RuntimeMetricsReport
} from "../diagnostics/metrics";
import {
  type CommandEnvelope,
  isCommandEnvelope,
  isEventEnvelope,
  ProtocolValidationError,
  type LocalBusEnvelope
} from "./types";
import { validateEnvelope } from "./validator";

export interface LocalBus {
  publish(event: LocalBusEnvelope): Promise<void>;
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
}

type HandledMethod =
  | "lane.create"
  | "session.attach"
  | "terminal.spawn"
  | "terminal.input"
  | "terminal.resize"
  | "renderer.capabilities"
  | "renderer.switch";

type MethodTransitionSpec = {
  requested: RuntimeEvent;
  succeeded: RuntimeEvent;
  failed: RuntimeEvent;
  startedTopic: LifecycleTopic;
  successTopic: LifecycleTopic;
  failedTopic: LifecycleTopic;
  resultKey: "lane_id" | "session_id";
};

type LifecycleName = "lane.create" | "session.attach" | "terminal.spawn";
type LifecycleTopic =
  | "lane.create.started"
  | "lane.created"
  | "lane.create.failed"
  | "session.attach.started"
  | "session.attached"
  | "session.attach.failed"
  | "session.restore.started"
  | "session.restore.completed"
  | "terminal.spawn.started"
  | "terminal.spawned"
  | "terminal.spawn.failed";

type LifecycleProgress = {
  lifecycle: LifecycleName;
  state: "started";
};

const METHOD_SPECS: Record<"lane.create" | "session.attach", MethodTransitionSpec> = {
  "lane.create": {
    requested: "lane.create.requested",
    succeeded: "lane.create.succeeded",
    failed: "lane.create.failed",
    startedTopic: "lane.create.started",
    successTopic: "lane.created",
    failedTopic: "lane.create.failed",
    resultKey: "lane_id"
  },
  "session.attach": {
    requested: "session.attach.requested",
    succeeded: "session.attach.succeeded",
    failed: "session.attach.failed",
    startedTopic: "session.attach.started",
    successTopic: "session.attached",
    failedTopic: "session.attach.failed",
    resultKey: "session_id"
  }
};

const TOPIC_LIFECYCLE: Record<LifecycleTopic, LifecycleName> = {
  "lane.create.started": "lane.create",
  "lane.created": "lane.create",
  "lane.create.failed": "lane.create",
  "session.attach.started": "session.attach",
  "session.attached": "session.attach",
  "session.attach.failed": "session.attach",
  "session.restore.started": "session.attach",
  "session.restore.completed": "session.attach",
  "terminal.spawn.started": "terminal.spawn",
  "terminal.spawned": "terminal.spawn",
  "terminal.spawn.failed": "terminal.spawn"
};

const START_TOPICS = new Set<LifecycleTopic>([
  "lane.create.started",
  "session.attach.started",
  "session.restore.started",
  "terminal.spawn.started"
]);

const END_TOPICS = new Set<LifecycleTopic>([
  "lane.created",
  "lane.create.failed",
  "session.attached",
  "session.attach.failed",
  "session.restore.completed",
  "terminal.spawned",
  "terminal.spawn.failed"
]);

const DEFAULT_TERMINAL_BUFFER_CAP_BYTES = 64 * 1024;

function isHandledMethod(method: string): method is HandledMethod {
  return (
    method === "lane.create" ||
    method === "session.attach" ||
    method === "terminal.spawn" ||
    method === "terminal.input" ||
    method === "terminal.resize" ||
    method === "renderer.capabilities" ||
    method === "renderer.switch"
  );
}

function isLifecycleTopic(topic: string): topic is LifecycleTopic {
  return topic in TOPIC_LIFECYCLE;
}

type InMemoryLocalBusOptions = {
  terminalBufferCapBytes?: number;
  auditSink?: AuditSink;
};

export class InMemoryLocalBus implements LocalBus {
  private state: RuntimeState = INITIAL_RUNTIME_STATE;
  private rendererEngine: "ghostty" | "rio" = "ghostty";
  private sequence = 0;
  private readonly eventLog: LocalBusEnvelope[] = [];
  private readonly auditSink: AuditSink;
  private readonly lifecycleProgressByCorrelation = new Map<string, LifecycleProgress>();
  private readonly terminalRegistry = new TerminalRegistry();
  private readonly terminalBuffer: TerminalOutputBuffer;
  private readonly metrics = new RuntimeMetrics();
  private terminalCounter = 0;

  constructor(options: InMemoryLocalBusOptions = {}) {
    this.auditSink = options.auditSink ?? new InMemoryAuditSink();
    this.terminalBuffer = new TerminalOutputBuffer(
      options.terminalBufferCapBytes ?? DEFAULT_TERMINAL_BUFFER_CAP_BYTES
    );
  }

  getState(): RuntimeState {
    return this.state;
  }

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
  }

  getTerminal(terminalId: string): TerminalContext | undefined {
    return this.terminalRegistry.get(terminalId);
  }

  getTerminalBuffer(terminalId: string) {
    return this.terminalBuffer.get(terminalId);
  }

  getMetricsReport(): RuntimeMetricsReport {
    return this.metrics.getReport();
  }

  async getAuditRecords(): Promise<AuditRecord[]> {
    if (this.auditSink instanceof InMemoryAuditSink) {
      return this.auditSink.getRecords();
    }
    return [];
  }

  async publish(event: LocalBusEnvelope): Promise<void> {
    try {
      const envelope = validateEnvelope(event);
      this.assertDeterministicOrdering(envelope);

      this.sequence += 1;
      const stampedEnvelope: LocalBusEnvelope = {
        ...envelope,
        sequence: this.sequence,
        envelope_id: envelope.envelope_id ?? envelope.id,
        timestamp: envelope.timestamp ?? envelope.ts
      };
      this.eventLog.push(stampedEnvelope);
      await this.captureBacklogDepthMetric(stampedEnvelope);

      await this.auditSink.append({
        recorded_at: new Date().toISOString(),
        sequence: this.sequence,
        outcome: "accepted",
        reason: null,
        envelope: stampedEnvelope
      });
    } catch (error) {
      const reason =
        error instanceof Error ? `${error.name}:${error.message}` : "Unknown publish error";
      await this.auditSink.append({
        recorded_at: new Date().toISOString(),
        sequence: null,
        outcome: "rejected",
        reason,
        envelope: event
      });
      throw error;
    }
  }

  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    let envelope: LocalBusEnvelope;
    try {
      envelope = validateEnvelope(command);
    } catch (error) {
      if (
        error instanceof ProtocolValidationError &&
        error.code === "MISSING_CORRELATION_ID" &&
        command.type === "command"
      ) {
        return this.errorResponse(
          command as CommandEnvelope,
          "MISSING_CORRELATION_ID",
          "correlation_id is required"
        );
      }
      throw error;
    }

    if (!isCommandEnvelope(envelope)) {
      throw new ProtocolValidationError(
        "INVALID_ENVELOPE_TYPE",
        "Bus request accepts command envelopes only"
      );
    }

    if (envelope.method === "terminal.spawn") {
      return this.handleTerminalSpawn(envelope);
    }
    if (envelope.method === "terminal.input") {
      return this.handleTerminalInput(envelope);
    }
    if (envelope.method === "terminal.resize") {
      return this.handleTerminalResize(envelope);
    }
    if (envelope.method === "renderer.capabilities") {
      return this.okResponse(envelope, {
        active_engine: this.rendererEngine,
        available_engines: ["ghostty", "rio"],
        hot_swap_supported: true
      });
    }
    if (envelope.method === "renderer.switch") {
      return this.handleRendererSwitch(envelope);
    }
    if (envelope.method === "lane.create" || envelope.method === "session.attach") {
      return this.handleLifecycleCommand(envelope, envelope.method);
    }

    return {
      id: envelope.id,
      type: "response",
      ts: new Date().toISOString(),
      workspace_id: envelope.workspace_id,
      lane_id: envelope.lane_id,
      session_id: envelope.session_id,
      terminal_id: envelope.terminal_id,
      correlation_id: envelope.correlation_id,
      method: envelope.method,
      status: "ok",
      result: {}
    };
  }

  private assertDeterministicOrdering(envelope: LocalBusEnvelope): void {
    if (!isEventEnvelope(envelope) || !isLifecycleTopic(envelope.topic)) {
      return;
    }

    const correlationId = envelope.correlation_id;
    if (!correlationId) {
      throw new ProtocolValidationError(
        "MISSING_CORRELATION_ID",
        `Lifecycle topic '${envelope.topic}' requires correlation_id`
      );
    }

    const lifecycle = TOPIC_LIFECYCLE[envelope.topic];
    const current = this.lifecycleProgressByCorrelation.get(correlationId);

    if (START_TOPICS.has(envelope.topic)) {
      if (current) {
        throw new ProtocolValidationError(
          "ORDERING_VIOLATION",
          "Lifecycle already started for correlation_id",
          {
            correlation_id: correlationId,
            lifecycle: current.lifecycle,
            topic: envelope.topic
          }
        );
      }
      this.lifecycleProgressByCorrelation.set(correlationId, { lifecycle, state: "started" });
      return;
    }

    if (!current || current.lifecycle !== lifecycle) {
      throw new ProtocolValidationError(
        "ORDERING_VIOLATION",
        "Lifecycle terminal event without start event",
        {
          correlation_id: correlationId,
          lifecycle,
          topic: envelope.topic
        }
      );
    }

    if (END_TOPICS.has(envelope.topic)) {
      this.lifecycleProgressByCorrelation.delete(correlationId);
      return;
    }
  }

  private async handleLifecycleCommand(
    command: CommandEnvelope,
    method: "lane.create" | "session.attach"
  ): Promise<LocalBusEnvelope> {
    const spec = METHOD_SPECS[method];
    const forcedError = command.payload.force_error === true;
    const resultId =
      (command.payload.id as string | undefined) ?? `${spec.resultKey}_${Date.now()}`;
    const lifecycleCommand =
      method === "lane.create" && !command.lane_id
        ? { ...command, lane_id: resultId }
        : command;
    const restoreLifecycleCommand =
      command.correlation_id === undefined
        ? null
        : ({ ...command, correlation_id: `${command.correlation_id}:restore` } as CommandEnvelope);
    const laneCreateMetric = method === "lane.create" ? "lane_create_latency_ms" : null;
    const sessionRestoreMetric =
      method === "session.attach" && command.payload.restore === true
        ? "session_restore_latency_ms"
        : null;

    if (laneCreateMetric) {
      this.metrics.startTimer(laneCreateMetric, command.id);
    }
    if (sessionRestoreMetric) {
      this.metrics.startTimer(sessionRestoreMetric, command.id);
      if (restoreLifecycleCommand) {
        await this.emitTransitionEvent(
          restoreLifecycleCommand,
          "session.restore.started",
          "session.restore.started"
        );
      }
    }

    await this.emitTransitionEvent(lifecycleCommand, spec.requested, spec.startedTopic);

    if (forcedError) {
      await this.emitTransitionEvent(lifecycleCommand, spec.failed, spec.failedTopic);
      await this.recordLatencyMetrics(command, laneCreateMetric, sessionRestoreMetric, {
        status: "error",
        method,
        workspace_id: command.workspace_id ?? "unknown",
        lane_id: command.lane_id ?? "unknown",
        session_id: command.session_id ?? "unknown"
      });
      return this.errorResponse(
        command,
        `${method.toUpperCase().replace(".", "_")}_FAILED`,
        `${method} failed`,
        { method },
        true
      );
    }

    await this.emitTransitionEvent(lifecycleCommand, spec.succeeded, spec.successTopic);
    if (sessionRestoreMetric && restoreLifecycleCommand) {
      await this.emitTransitionEvent(
        restoreLifecycleCommand,
        "session.restore.completed",
        "session.restore.completed"
      );
    }
    await this.recordLatencyMetrics(command, laneCreateMetric, sessionRestoreMetric, {
      status: "ok",
      method,
      workspace_id: command.workspace_id ?? "unknown",
      lane_id: command.lane_id ?? "unknown",
      session_id: command.session_id ?? "unknown"
    });
    return this.okResponse(command, {
      [spec.resultKey]: resultId,
      state: this.state
    });
  }

  private async handleTerminalSpawn(command: CommandEnvelope): Promise<LocalBusEnvelope> {
    const workspaceId = command.workspace_id;
    const laneId = command.lane_id;
    const sessionId = this.readString(command.payload.session_id) ?? command.session_id;

    if (!workspaceId || !laneId || !sessionId || !command.correlation_id) {
      return this.errorResponse(
        command,
        "INVALID_TERMINAL_CONTEXT",
        "workspace_id, lane_id, and session_id are required"
      );
    }

    this.terminalCounter += 1;
    const terminalId =
      this.readString(command.payload.terminal_id) ?? `${sessionId}:terminal:${this.terminalCounter}`;
    const title = this.readString(command.payload.title) ?? "Terminal";
    const existingTerminal = this.terminalRegistry.get(terminalId);
    if (existingTerminal) {
      this.terminalBuffer.clear(terminalId);
    }

    this.terminalRegistry.spawn({
      terminal_id: terminalId,
      workspace_id: workspaceId,
      lane_id: laneId,
      session_id: sessionId,
      title
    });

    await this.emitTransitionEvent(command, "terminal.spawn.requested", "terminal.spawn.started");
    await this.emitTerminalStateChanged(command, terminalId, "spawning", {
      runtime_event: "terminal.spawn.requested"
    });

    this.state = transition(this.state, "terminal.spawn.succeeded");
    await this.emitTerminalStateChanged(command, terminalId, "active", {
      runtime_event: "terminal.spawn.succeeded"
    });

    await this.publish({
      id: `${command.id}:terminal.spawned`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: workspaceId,
      lane_id: laneId,
      session_id: sessionId,
      terminal_id: terminalId,
      correlation_id: command.correlation_id,
      topic: "terminal.spawned",
      payload: {
        terminal_id: terminalId,
        lane_id: laneId,
        session_id: sessionId,
        workspace_id: workspaceId,
        state: "active",
        title
      }
    });

    return this.okResponse(command, {
      terminal_id: terminalId,
      lane_id: laneId,
      session_id: sessionId,
      state: "active"
    });
  }

  private handleRendererSwitch(command: CommandEnvelope): LocalBusEnvelope {
    const forcedError = command.payload.force_error === true;
    if (forcedError) {
      return this.errorResponse(
        command,
        "RENDERER_SWITCH_FAILED",
        "renderer.switch failed",
        { method: "renderer.switch" },
        true
      );
    }

    const targetEngine = this.readString(command.payload.target_engine);
    if (targetEngine !== "ghostty" && targetEngine !== "rio") {
      return this.errorResponse(
        command,
        "INVALID_RENDERER_ENGINE",
        "target_engine must be one of: ghostty, rio"
      );
    }

    const previousEngine = this.rendererEngine;
    this.rendererEngine = targetEngine;
    return this.okResponse(command, {
      active_engine: this.rendererEngine,
      previous_engine: previousEngine
    });
  }

  private async handleTerminalInput(command: CommandEnvelope): Promise<LocalBusEnvelope> {
    const terminalId = command.terminal_id ?? this.readString(command.payload.terminal_id);
    const workspaceId = command.workspace_id;
    const laneId = command.lane_id;
    const sessionId = command.session_id ?? this.readString(command.payload.session_id);

    if (!terminalId || !workspaceId || !laneId || !sessionId) {
      return this.errorResponse(
        command,
        "INVALID_TERMINAL_CONTEXT",
        "terminal_id, workspace_id, lane_id, and session_id are required"
      );
    }

    if (
      !this.terminalRegistry.isOwnedBy(terminalId, {
        workspace_id: workspaceId,
        lane_id: laneId,
        session_id: sessionId
      })
    ) {
      return this.errorResponse(
        command,
        "TERMINAL_CONTEXT_MISMATCH",
        "terminal does not belong to the provided workspace/lane/session context"
      );
    }

    const inputData = this.readNonEmptyString(command.payload.data);
    if (!inputData) {
      return this.errorResponse(
        command,
        "INVALID_TERMINAL_INPUT",
        "payload.data must be a non-empty string"
      );
    }

    const outputSeq = this.terminalRegistry.incrementOutputSeq(terminalId);
    const outputEntry = {
      seq: outputSeq,
      chunk: inputData,
      ts: new Date().toISOString()
    };
    const bufferResult = this.terminalBuffer.push(terminalId, outputEntry);
    const backlogDepth = this.terminalBuffer.get(terminalId).entries.length;

    await this.publish({
      id: `${command.id}:terminal.output:${outputSeq}`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: workspaceId,
      lane_id: laneId,
      session_id: sessionId,
      terminal_id: terminalId,
      correlation_id: command.correlation_id,
      topic: "terminal.output",
      payload: {
        terminal_id: terminalId,
        seq: outputSeq,
        chunk: inputData,
        backlog_depth: backlogDepth,
        overflowed: bufferResult.overflowed,
        dropped_bytes: bufferResult.droppedBytes
      }
    });

    if (bufferResult.overflowed) {
      this.state = transition(this.state, "terminal.throttled");
      await this.emitTerminalStateChanged(command, terminalId, "throttled", {
        runtime_event: "terminal.throttled",
        dropped_bytes: bufferResult.droppedBytes
      });
    }

    return this.okResponse(command, {
      terminal_id: terminalId,
      accepted_bytes: new TextEncoder().encode(inputData).byteLength,
      output_seq: outputSeq,
      backlog_depth: backlogDepth
    });
  }

  private async captureBacklogDepthMetric(event: LocalBusEnvelope): Promise<void> {
    if (event.type !== "event" || event.topic !== "terminal.output") {
      return;
    }
    const depth = event.payload.backlog_depth;
    if (typeof depth !== "number" || Number.isNaN(depth)) {
      return;
    }

    const sample = this.metrics.record("terminal_output_backlog_depth", depth, "count", {
      workspace_id: event.workspace_id ?? "unknown",
      session_id: event.session_id ?? "unknown",
      terminal_id: event.terminal_id ?? "unknown"
    });
    await this.appendMetricEvent(event, sample);
  }

  private async recordLatencyMetrics(
    command: CommandEnvelope,
    laneCreateMetric: "lane_create_latency_ms" | null,
    sessionRestoreMetric: "session_restore_latency_ms" | null,
    tags: Record<string, string>
  ): Promise<void> {
    if (laneCreateMetric) {
      const sample = this.metrics.endTimer(laneCreateMetric, command.id, tags);
      if (sample) {
        await this.appendMetricEvent(command, sample);
      }
    }
    if (sessionRestoreMetric) {
      const sample = this.metrics.endTimer(sessionRestoreMetric, command.id, tags);
      if (sample) {
        await this.appendMetricEvent(command, sample);
      }
    }
  }

  private async appendMetricEvent(source: LocalBusEnvelope, sample: RuntimeMetricSample): Promise<void> {
    await this.publish({
      id: `${source.id}:metric:${sample.metric}:${this.sequence + 1}`,
      type: "event",
      ts: sample.ts,
      workspace_id: source.workspace_id,
      lane_id: source.lane_id,
      session_id: source.session_id,
      terminal_id: source.terminal_id,
      correlation_id: source.correlation_id,
      topic: "diagnostics.metric",
      payload: {
        metric: sample.metric,
        value: sample.value,
        unit: sample.unit,
        tags: sample.tags ?? {}
      }
    });
  }

  private async handleTerminalResize(command: CommandEnvelope): Promise<LocalBusEnvelope> {
    const terminalId = command.terminal_id ?? this.readString(command.payload.terminal_id);
    const workspaceId = command.workspace_id;
    const laneId = command.lane_id;
    const sessionId = command.session_id ?? this.readString(command.payload.session_id);
    const cols = this.readNumber(command.payload.cols);
    const rows = this.readNumber(command.payload.rows);

    if (!terminalId || !workspaceId || !laneId || !sessionId || !cols || !rows || cols < 1 || rows < 1) {
      return this.errorResponse(
        command,
        "INVALID_TERMINAL_RESIZE",
        "terminal_id, workspace_id, lane_id, session_id, cols, and rows are required"
      );
    }

    if (
      !this.terminalRegistry.isOwnedBy(terminalId, {
        workspace_id: workspaceId,
        lane_id: laneId,
        session_id: sessionId
      })
    ) {
      return this.errorResponse(
        command,
        "TERMINAL_CONTEXT_MISMATCH",
        "terminal does not belong to the provided workspace/lane/session context"
      );
    }

    this.state = transition(this.state, "terminal.spawn.succeeded");
    await this.emitTerminalStateChanged(command, terminalId, "active", {
      reason: "resize",
      cols,
      rows,
      runtime_event: "terminal.spawn.succeeded"
    });

    return this.okResponse(command, {
      terminal_id: terminalId,
      cols,
      rows,
      state: "active"
    });
  }

  private async emitTerminalStateChanged(
    command: CommandEnvelope,
    terminalId: string,
    state: TerminalLifecycleState,
    payload: Record<string, unknown>
  ): Promise<void> {
    const terminal = this.terminalRegistry.setState(terminalId, state);
    await this.publish({
      id: `${command.id}:terminal.state.changed:${state}:${this.sequence + 1}`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: command.workspace_id,
      lane_id: command.lane_id,
      session_id: command.session_id ?? this.readString(command.payload.session_id),
      terminal_id: terminalId,
      correlation_id: command.correlation_id,
      topic: "terminal.state.changed",
      payload: {
        ...payload,
        state,
        terminal: terminal ?? null,
        runtime_state: this.state
      }
    });
  }

  private async emitTransitionEvent(
    command: CommandEnvelope,
    runtimeEvent: RuntimeEvent,
    topic: LifecycleTopic
  ): Promise<void> {
    this.state = transition(this.state, runtimeEvent);
    await this.publish({
      id: `${command.id}:${runtimeEvent}`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: command.workspace_id,
      lane_id: command.lane_id,
      session_id: command.session_id,
      terminal_id: command.terminal_id,
      correlation_id: command.correlation_id,
      topic,
      payload: {
        runtime_event: runtimeEvent,
        state: this.state
      }
    });
  }

  private okResponse(
    command: CommandEnvelope,
    result: Record<string, unknown>
  ): LocalBusEnvelope {
    return {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      workspace_id: command.workspace_id,
      lane_id: command.lane_id,
      session_id: command.session_id,
      terminal_id: command.terminal_id,
      correlation_id: command.correlation_id,
      method: command.method,
      status: "ok",
      result
    };
  }

  private errorResponse(
    command: CommandEnvelope,
    code: string,
    message: string,
    details?: Record<string, unknown>,
    retryable = false
  ): LocalBusEnvelope {
    return {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      workspace_id: command.workspace_id,
      lane_id: command.lane_id,
      session_id: command.session_id,
      terminal_id: command.terminal_id,
      correlation_id: command.correlation_id,
      method: command.method,
      status: "error",
      result: null,
      error: {
        code,
        message,
        retryable,
        details: details ?? null
      }
    };
  }

  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readNonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
  }
}
