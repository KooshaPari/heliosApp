import type { LocalBusEnvelope, CommandEnvelope, ResponseEnvelope, EventEnvelope } from "./types.js";
import type { BusError } from "./errors.js";
import { validateEnvelope, createResponse } from "./envelope.js";
import { methodNotFound, handlerError, validationError } from "./errors.js";
import { MethodRegistry, type MethodHandler } from "./methods.js";
import { TopicRegistry, type TopicSubscriber } from "./topics.js";

// ---------------------------------------------------------------------------
// LocalBus interface (rich typed bus used by tests and runtime)
// ---------------------------------------------------------------------------

export interface LocalBus {
  // Command dispatch
  registerMethod(method: string, handler: MethodHandler): void;
  send(command: unknown): Promise<ResponseEnvelope>;
  getActiveCorrelationId(): string | undefined;

  // Event pub/sub
  subscribe(topic: string, subscriber: TopicSubscriber): () => void;
  publish(event: unknown): Promise<void>;

  // Lifecycle
  destroy(): void;

  // Legacy / flat envelope support
  request?(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
  getEvents?(): LocalBusEnvelope[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BusOptions {
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// createBus factory
// ---------------------------------------------------------------------------

export function createBus(options?: BusOptions): LocalBus {
  const methods = new MethodRegistry();
  const topics = new TopicRegistry();
  const maxDepth = options?.maxDepth ?? 16;
  let currentDepth = 0;
  let activeCorrelationId: string | undefined;
  let destroyed = false;

  const bus: LocalBus = {
    registerMethod(method: string, handler: MethodHandler): void {
      methods.register(method, handler);
    },

    async send(input: unknown): Promise<ResponseEnvelope> {
      if (destroyed) {
        return {
          id: "err",
          correlation_id: "",
          timestamp: performance.now(),
          type: "response",
          method: "",
          payload: null,
          error: validationError("Bus has been destroyed"),
        };
      }

      const validation = validateEnvelope(input);
      if (!validation.valid) {
        return {
          id: "err",
          correlation_id: "",
          timestamp: performance.now(),
          type: "response",
          method: "",
          payload: null,
          error: validation.error,
        };
      }

      const envelope = validation.envelope;
      if (envelope.type !== "command") {
        return {
          id: "err",
          correlation_id: (envelope as unknown as CommandEnvelope).correlation_id ?? "",
          timestamp: performance.now(),
          type: "response",
          method: "",
          payload: null,
          error: validationError("Expected a command envelope"),
        };
      }

      const cmd = envelope as CommandEnvelope;

      if (currentDepth >= maxDepth) {
        return createResponse(cmd, null, validationError(`Re-entrant depth limit (${maxDepth}) exceeded`));
      }

      const handler = methods.resolve(cmd.method);
      if (!handler) {
        return createResponse(cmd, null, methodNotFound(cmd.method));
      }

      const prevCorrelation = activeCorrelationId;
      activeCorrelationId = cmd.correlation_id;
      currentDepth++;

      try {
        const result = await handler(cmd);
        // Validate that handler returned a proper envelope
        if (!result || typeof result !== "object" || result.type !== "response") {
          return createResponse(cmd, null, handlerError(cmd.method, new Error("Handler did not return a response envelope")));
        }
        return { ...result, correlation_id: cmd.correlation_id };
      } catch (err) {
        return createResponse(cmd, null, handlerError(cmd.method, err));
      } finally {
        currentDepth--;
        activeCorrelationId = prevCorrelation;
      }
    },

    getActiveCorrelationId(): string | undefined {
      return activeCorrelationId;
    },

    subscribe(topic: string, subscriber: TopicSubscriber): () => void {
      return topics.subscribe(topic, subscriber);
    },

    async publish(input: unknown): Promise<void> {
      if (destroyed) return;

      const validation = validateEnvelope(input);
      if (!validation.valid) return;

      const envelope = validation.envelope;
      if (envelope.type !== "event") return;

      const evt = envelope as EventEnvelope;
      const seq = topics.nextSequence(evt.topic);
      const seqEvt: EventEnvelope = { ...evt, sequence: seq };

      const subscribers = topics.subscribers(evt.topic);
      for (const sub of subscribers) {
        try {
          await sub(seqEvt);
        } catch {
          // FR-009: subscriber isolation - errors don't propagate
        }
      }
    },

    destroy(): void {
      destroyed = true;
      methods.clear();
      topics.clear();
    },
  };

  return bus;
}

// ---------------------------------------------------------------------------
// InMemoryLocalBus (flat envelope bus - legacy)
// ---------------------------------------------------------------------------

export class InMemoryLocalBus implements LocalBus {
  private readonly eventLog: LocalBusEnvelope[] = [];

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
  }

  registerMethod(_method: string, _handler: MethodHandler): void {
    // no-op for test stub
  }

  async send(_command: unknown): Promise<ResponseEnvelope> {
    return {
      id: "stub",
      correlation_id: "",
      timestamp: performance.now(),
      type: "response",
      method: "",
      payload: null,
    };
  }

  getActiveCorrelationId(): string | undefined {
    return undefined;
  }

  subscribe(_topic: string, _subscriber: TopicSubscriber): () => void {
    return () => {};
  }

  async publish(event: LocalBusEnvelope | unknown): Promise<void> {
    this.eventLog.push(event as LocalBusEnvelope);
  }

  destroy(): void {
    // no-op for test stub
  }

  async request(_command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    return {
      id: _command.id,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {},
    };
  }
}
