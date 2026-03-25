import type { MethodHandler } from "./methods.js";
import type {
  CommandEnvelope,
  EventEnvelope,
  ResponseEnvelope,
  LocalBusEnvelope,
} from "./types.js";
import type { CommandBusOptions, LocalBus } from "./bus_contract.js";

function makeErrorResponse(
  _id: string,
  correlationId: string | undefined,
  method: string,
  code: string,
  message: string,
): ResponseEnvelope {
  return {
    id: `res_${Date.now()}`,
    correlation_id: correlationId ?? "unknown",
    timestamp: performance.now(),
    type: "response",
    method,
    payload: null,
    status: "error",
    error: { code, message, retryable: false },
  };
}

function isCommandEnvelope(value: unknown): value is CommandEnvelope {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "command" &&
    typeof (value as Record<string, unknown>).method === "string" &&
    typeof (value as Record<string, unknown>).id === "string" &&
    "payload" in (value as Record<string, unknown>)
  );
}

function isEventEnvelope(value: unknown): value is EventEnvelope {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "event" &&
    typeof (value as Record<string, unknown>).topic === "string"
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
  private activeCorrelationId: string | undefined;
  private currentDepth = 0;
  private readonly topicSequenceCounters = new Map<string, number>();

  constructor(options: CommandBusOptions = {}) {
    this.options = { maxDepth: options.maxDepth ?? 10 };
  }

  registerMethod(method: string, handler: MethodHandler): void {
    this.methods.set(method, handler);
  }

  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    return (await this.send(command as unknown as CommandEnvelope)) as LocalBusEnvelope;
  }

  async send(envelope: unknown): Promise<ResponseEnvelope> {
    if (this.destroyed) {
      return makeErrorResponse(this.readId(envelope), this.readCorrelationId(envelope), "", "VALIDATION_ERROR", "Bus is destroyed");
    }

    if (!isCommandEnvelope(envelope)) {
      const id = this.readId(envelope);
      const correlationId = this.readCorrelationId(envelope);
      const type = (envelope as Record<string, unknown>)?.type;
      if (type === "event" || type === "response") {
        return makeErrorResponse(id, correlationId, "", "VALIDATION_ERROR", "Expected a command envelope");
      }
      return makeErrorResponse(id, correlationId, "", "VALIDATION_ERROR", "Malformed envelope");
    }

    const command = envelope;
    if (this.currentDepth >= this.options.maxDepth) {
      return makeErrorResponse(
        command.id,
        command.correlation_id,
        command.method,
        "HANDLER_ERROR",
        `Re-entrant depth limit exceeded (max ${this.options.maxDepth})`,
      );
    }

    const handler = this.methods.get(command.method);
    if (!handler) {
      return makeErrorResponse(
        command.id,
        command.correlation_id,
        command.method,
        "METHOD_NOT_FOUND",
        `No handler registered for method: ${command.method}`,
      );
    }

    const previousCorrelationId = this.activeCorrelationId;
    this.activeCorrelationId = command.correlation_id;
    this.currentDepth += 1;
    try {
      const result = await handler(command);
      if (
        !result ||
        typeof result !== "object" ||
        (result as Record<string, unknown>).type !== "response"
      ) {
        return makeErrorResponse(
          command.id,
          command.correlation_id,
          command.method,
          "HANDLER_ERROR",
          `Handler for "${command.method}" returned non-envelope value`,
        );
      }
      return result as ResponseEnvelope;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/\/[\w/.:-]+/g, "<path>") : String(error);
      return makeErrorResponse(
        command.id,
        command.correlation_id,
        command.method,
        "HANDLER_ERROR",
        `Handler for "${command.method}" failed: ${message}`,
      );
    } finally {
      this.currentDepth -= 1;
      this.activeCorrelationId = previousCorrelationId;
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
      if (!current) {
        return;
      }
      const index = current.indexOf(entry);
      if (index !== -1) {
        current.splice(index, 1);
      }
      if (current.length === 0) {
        this.subscribers.delete(topic);
      }
    };
  }

  async publish(event: unknown): Promise<void> {
    if (this.destroyed || !isEventEnvelope(event)) {
      return;
    }

    if (this.activeCorrelationId) {
      (event as Record<string, unknown>).correlation_id = this.activeCorrelationId;
    }

    const topic = event.topic;
    const nextSequence = (this.topicSequenceCounters.get(topic) ?? 0) + 1;
    this.topicSequenceCounters.set(topic, nextSequence);
    (event as Record<string, unknown>).sequence = nextSequence;

    const subscribers = this.subscribers.get(topic);
    if (!subscribers) {
      return;
    }

    const snapshot = subscribers.map((entry) => entry.handler);
    for (const handler of snapshot) {
      try {
        await handler(event);
      } catch {
        // Subscriber isolation is intentional.
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

  private readCorrelationId(value: unknown): string | undefined {
    return typeof (value as Record<string, unknown>)?.correlation_id === "string"
      ? ((value as Record<string, unknown>).correlation_id as string)
      : "unknown";
  }

  private readId(value: unknown): string {
    return typeof (value as Record<string, unknown>)?.id === "string"
      ? ((value as Record<string, unknown>).id as string)
      : "unknown";
  }
}

export function createBus(options?: CommandBusOptions): LocalBus {
  return new CommandBusImpl(options);
}
