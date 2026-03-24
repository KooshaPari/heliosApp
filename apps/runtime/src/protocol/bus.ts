import { AsyncLocalStorage } from "node:async_hooks";
import type { CommandEnvelope, EventEnvelope, LocalBusEnvelope, ResponseEnvelope } from "./types.js";
import type { MethodHandler } from "./methods.js";

export { InMemoryLocalBus } from "./bus_in_memory.js";
export type {
  AuditRecord,
  MetricSample,
  MetricSummary,
  MetricsReport,
  BusState,
} from "./bus_in_memory.js";

export interface LocalBus {
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
  publish(event: LocalBusEnvelope): Promise<void>;
}

export interface CommandBus {
  registerMethod(method: string, handler: MethodHandler): void;
  send(envelope: unknown): Promise<ResponseEnvelope>;
  subscribe(topic: string, handler: (evt: EventEnvelope) => void | Promise<void>): () => void;
  publish(evt: unknown): Promise<void>;
  destroy(): void;
  getActiveCorrelationId(): string | undefined;
}

export type CommandBusOptions = {
  maxDepth?: number;
};

const correlationContext = new AsyncLocalStorage<string>();

export function getActiveCorrelationId(): string | undefined {
  return correlationContext.getStore();
}

function makeErrorResponse(
  _id: string,
  correlationId: string,
  method: string,
  code: string,
  message: string,
  details?: Record<string, unknown>
): ResponseEnvelope {
  return {
    id: `res_${Date.now()}`,
    // biome-ignore lint/style/useNamingConvention: Protocol field names intentionally use snake_case.
    correlation_id: correlationId,
    timestamp: performance.now(),
    type: "response",
    method,
    error: {
      code,
      message,
      retryable: false,
      ...(details !== undefined ? { details } : {}),
    },
  } as ResponseEnvelope;
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

class CommandBusImpl implements CommandBus {
  private readonly methods = new Map<string, MethodHandler>();
  private readonly subscribers = new Map<
    string,
    Array<{ handler: (evt: EventEnvelope) => void | Promise<void>; removed: boolean }>
  >();
  private readonly options: Required<CommandBusOptions>;
  private destroyed = false;
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
    const correlationId = cmd.correlation_id ?? "";

    return correlationContext.run(correlationId, async (): Promise<ResponseEnvelope> => {
      if (this.currentDepth >= this.options.maxDepth) {
        return makeErrorResponse(
          cmd.id,
          correlationId,
          cmd.method,
          "HANDLER_ERROR",
          `Re-entrant depth limit exceeded (max ${this.options.maxDepth})`
        );
      }

      const handler = this.methods.get(cmd.method);
      if (!handler) {
        return makeErrorResponse(
          cmd.id,
          correlationId,
          cmd.method,
          "METHOD_NOT_FOUND",
          `No handler registered for method: ${cmd.method}`
        );
      }

      this.currentDepth++;
      try {
        const result = await handler(cmd);
        if (
          !result ||
          typeof result !== "object" ||
          (result as Record<string, unknown>).type !== "response"
        ) {
          return makeErrorResponse(
            cmd.id,
            correlationId,
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
          correlationId,
          cmd.method,
          "HANDLER_ERROR",
          `Handler for "${cmd.method}" failed: ${msg}`
        );
      } finally {
        this.currentDepth--;
      }
    });
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

    if (!isEventEnvelope(evt)) {
      return;
    }

    const event = evt as EventEnvelope;
    const activeCorrelationId = correlationContext.getStore();
    if (activeCorrelationId) {
      (event as Record<string, unknown>).correlation_id = activeCorrelationId;
    }

    const topic = event.topic;
    const currentSeq = this.topicSequenceCounters.get(topic) ?? 0;
    const nextSeq = currentSeq + 1;
    this.topicSequenceCounters.set(topic, nextSeq);
    (event as Record<string, unknown>).sequence = nextSeq;
    const list = this.subscribers.get(topic);
    if (!list) {
      return;
    }

    const snapshot = list.map(entry => entry.handler);
    for (const handler of snapshot) {
      try {
        await handler(event);
      } catch {
        // subscriber isolation
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.methods.clear();
    this.subscribers.clear();
  }

  getActiveCorrelationId(): string | undefined {
    return correlationContext.getStore();
  }
}

export function createBus(options?: CommandBusOptions): CommandBus {
  return new CommandBusImpl(options);
}
