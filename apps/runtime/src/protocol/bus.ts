import { InMemoryAuditSink, type AuditRecord, type AuditSink } from "../audit/sink";
import {
  INITIAL_RUNTIME_STATE,
  transition,
  type RuntimeEvent,
  type RuntimeState
} from "../sessions/state_machine";
import {
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

type HandledMethod = "lane.create" | "session.attach" | "terminal.spawn";

type MethodTransitionSpec = {
  requested: RuntimeEvent;
  succeeded: RuntimeEvent;
  failed: RuntimeEvent;
  startedTopic: LifecycleTopic;
  successTopic: LifecycleTopic;
  failedTopic: LifecycleTopic;
  resultKey: "lane_id" | "session_id" | "terminal_id";
};

type LifecycleName = "lane.create" | "session.attach" | "terminal.spawn";
type LifecycleTopic =
  | "lane.create.started"
  | "lane.created"
  | "lane.create.failed"
  | "session.attach.started"
  | "session.attached"
  | "session.attach.failed"
  | "terminal.spawn.started"
  | "terminal.spawned"
  | "terminal.spawn.failed";

type LifecycleProgress = {
  lifecycle: LifecycleName;
  state: "started";
};

const METHOD_SPECS: Record<HandledMethod, MethodTransitionSpec> = {
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
    failed: "session.terminated",
    startedTopic: "session.attach.started",
    successTopic: "session.attached",
    failedTopic: "session.attach.failed",
    resultKey: "session_id"
  },
  "terminal.spawn": {
    requested: "terminal.spawn.requested",
    succeeded: "terminal.spawn.succeeded",
    failed: "terminal.error",
    startedTopic: "terminal.spawn.started",
    successTopic: "terminal.spawned",
    failedTopic: "terminal.spawn.failed",
    resultKey: "terminal_id"
  }
};

const TOPIC_LIFECYCLE: Record<LifecycleTopic, LifecycleName> = {
  "lane.create.started": "lane.create",
  "lane.created": "lane.create",
  "lane.create.failed": "lane.create",
  "session.attach.started": "session.attach",
  "session.attached": "session.attach",
  "session.attach.failed": "session.attach",
  "terminal.spawn.started": "terminal.spawn",
  "terminal.spawned": "terminal.spawn",
  "terminal.spawn.failed": "terminal.spawn"
};

const START_TOPICS = new Set<LifecycleTopic>([
  "lane.create.started",
  "session.attach.started",
  "terminal.spawn.started"
]);

const END_TOPICS = new Set<LifecycleTopic>([
  "lane.created",
  "lane.create.failed",
  "session.attached",
  "session.attach.failed",
  "terminal.spawned",
  "terminal.spawn.failed"
]);

function isHandledMethod(method: string): method is HandledMethod {
  return method in METHOD_SPECS;
}

function isLifecycleTopic(topic: string): topic is LifecycleTopic {
  return topic in TOPIC_LIFECYCLE;
}

type InMemoryLocalBusOptions = {
  auditSink?: AuditSink;
};

export class InMemoryLocalBus implements LocalBus {
  private state: RuntimeState = INITIAL_RUNTIME_STATE;
  private sequence = 0;
  private readonly eventLog: LocalBusEnvelope[] = [];
  private readonly auditSink: AuditSink;
  private readonly lifecycleProgressByCorrelation = new Map<string, LifecycleProgress>();

  constructor(options: InMemoryLocalBusOptions = {}) {
    this.auditSink = options.auditSink ?? new InMemoryAuditSink();
  }

  getState(): RuntimeState {
    return this.state;
  }

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
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
      const stampedEnvelope: LocalBusEnvelope = { ...envelope, sequence: this.sequence };
      this.eventLog.push(stampedEnvelope);

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
    const envelope = validateEnvelope(command);
    if (!isCommandEnvelope(envelope)) {
      throw new ProtocolValidationError(
        "INVALID_ENVELOPE_TYPE",
        "Bus request accepts command envelopes only"
      );
    }

    if (isHandledMethod(envelope.method)) {
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
    command: LocalBusEnvelope,
    method: HandledMethod
  ): Promise<LocalBusEnvelope> {
    const spec = METHOD_SPECS[method];
    const forcedError = command.payload.force_error === true;
    const resultId =
      (command.payload.id as string | undefined) ?? `${spec.resultKey}_${Date.now()}`;

    await this.emitTransitionEvent(command, spec.requested, spec.startedTopic);

    if (forcedError) {
      await this.emitTransitionEvent(command, spec.failed, spec.failedTopic);
      return {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        workspace_id: command.workspace_id,
        lane_id: command.lane_id,
        session_id: command.session_id,
        terminal_id: command.terminal_id,
        correlation_id: command.correlation_id,
        method,
        status: "error",
        result: null,
        error: {
          code: `${method.toUpperCase().replace(".", "_")}_FAILED`,
          message: `${method} failed`,
          retryable: true,
          details: { method }
        }
      };
    }

    await this.emitTransitionEvent(command, spec.succeeded, spec.successTopic);
    return {
      id: command.id,
      type: "response",
      ts: new Date().toISOString(),
      workspace_id: command.workspace_id,
      lane_id: command.lane_id,
      session_id: command.session_id,
      terminal_id: command.terminal_id,
      correlation_id: command.correlation_id,
      method,
      status: "ok",
      result: {
        [spec.resultKey]: resultId,
        state: this.state
      }
    };
  }

  private async emitTransitionEvent(
    command: LocalBusEnvelope,
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
}
