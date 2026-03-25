import {
  ProtocolValidationError,
  type LocalBusEnvelope,
  type LocalBusEnvelopeWithSequence,
} from "./types.js";
import { validateEnvelope } from "./validator.js";
import type { InMemoryBusContext } from "./bus_in_memory_context.js";
import {
  appendAcceptedEvent,
  emitMetricEvent,
  getSequence,
  recordMetric,
} from "./bus_in_memory_metrics.js";
import {
  buildErrorResponse,
  buildMethodNotSupportedResponse,
  payloadRecord,
} from "./bus_in_memory_envelope.js";

const TERMINAL_TOPICS = new Set([
  "lane.attached",
  "lane.attach.failed",
  "lane.cleaned",
  "lane.cleanup.failed",
  "session.attached",
  "session.attach.failed",
  "session.terminated",
  "session.terminate.failed",
  "lane.created",
  "lane.create.failed",
  "terminal.spawned",
  "terminal.spawn.failed",
]);

const START_TOPICS = new Set([
  "session.attach.started",
  "lane.attach.started",
  "lane.cleanup.started",
  "lane.create.started",
  "session.terminate.started",
  "terminal.spawn.started",
]);

function appendRejectedEvent(
  context: InMemoryBusContext,
  event: LocalBusEnvelope,
  error: string,
): void {
  context.auditLog.push({
    envelope: event,
    outcome: "rejected",
    error,
    recorded_at: new Date().toISOString(),
  });
}

export function ensureLifecycleProgress(
  lifecycleProgress: Map<string, Set<string>>,
  correlationId: string,
): Set<string> {
  let progress = lifecycleProgress.get(correlationId);
  if (!progress) {
    progress = new Set();
    lifecycleProgress.set(correlationId, progress);
  }
  return progress;
}

export function publishLifecycleEvent(
  context: InMemoryBusContext,
  topic: string,
  envelope: LocalBusEnvelope,
): void {
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
    sequence: getSequence(context) + 1,
  };
  appendAcceptedEvent(context, event);
}

export async function publishInMemoryEvent(
  context: InMemoryBusContext,
  candidate: unknown,
): Promise<void> {
  await Promise.resolve();

  let event: LocalBusEnvelope;
  try {
    event = validateEnvelope(candidate);
  } catch (error) {
    const auditError = error instanceof ProtocolValidationError ? error.message : String(error);
    appendRejectedEvent(context, candidate as LocalBusEnvelope, auditError);
    throw error;
  }

  const topic = event.topic;
  const correlationId = event.correlation_id ?? "";

  if (topic) {
    const isTerminalTopic = TERMINAL_TOPICS.has(topic);
    const isStartTopic = START_TOPICS.has(topic);

    if (isStartTopic) {
      const progress = ensureLifecycleProgress(context.lifecycleProgress, correlationId);
      if (progress.has(topic)) {
        const error = new ProtocolValidationError(
          "ORDERING_VIOLATION",
          `Duplicate start topic "${topic}" for correlation "${correlationId}"`,
        );
        appendRejectedEvent(context, event, error.message);
        throw error;
      }
      progress.add(topic);
      appendAcceptedEvent(context, event);
      return;
    }

    if (isTerminalTopic) {
      const seen = context.lifecycleProgress.get(correlationId);
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
                : "",
        )
        .replace(".created", ".create.started")
        .replace(".spawned", ".spawn.started");

      if (!seen?.has(expectedStart) && expectedStart !== topic) {
        const error = new ProtocolValidationError(
          "ORDERING_VIOLATION",
          `Topic '${topic}' cannot be published before '${expectedStart}'`,
        );
        appendRejectedEvent(context, event, error.message);
        throw error;
      }
      context.lifecycleProgress.delete(correlationId);
    }

    if (topic === "terminal.output") {
      const backlogDepth =
        typeof event.payload?.backlog_depth === "number" ? event.payload.backlog_depth : undefined;
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
      recordMetric(
        context,
        "terminal_output_backlog_depth",
        backlogDepth,
        Object.keys(tags).length > 0 ? tags : undefined,
      );
      emitMetricEvent(context, "terminal_output_backlog_depth", backlogDepth);
    }
  }

  const sequencedEvent = event as LocalBusEnvelopeWithSequence;
  if (sequencedEvent.sequence === undefined) {
    sequencedEvent.sequence = getSequence(context) + 1;
  }
  appendAcceptedEvent(context, event);
}
