/**
 * LocalBus — unified facade for the Helios in-process message bus.
 *
 * Provides command dispatch (single handler) and event fan-out (multi-subscriber)
 * with re-entrant safety, subscriber isolation, and structured error handling.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  CommandEnvelope,
  ResponseEnvelope,
  EventEnvelope,
  Envelope,
} from './types.js';
import { isCommand, isEvent } from './types.js';
import { createResponse } from './envelope.js';
import { validateEnvelope } from './envelope.js';
import {
  validationError,
  methodNotFound,
  handlerError,
} from './errors.js';
import type { BusError } from './errors.js';
import { MethodRegistry } from './methods.js';
import type { MethodHandler } from './methods.js';
import { TopicRegistry } from './topics.js';
import type { TopicSubscriber } from './topics.js';

// ---------------------------------------------------------------------------
// Correlation context (AsyncLocalStorage for proper async isolation)
// ---------------------------------------------------------------------------

const correlationStorage = new AsyncLocalStorage<string>();

/** Get the active correlation_id from the current async context. */
export function getActiveCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface BusOptions {
  /** Maximum re-entrant dispatch depth (default 10). */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 10;

// ---------------------------------------------------------------------------
// LocalBus
// ---------------------------------------------------------------------------

export class LocalBus {
  private readonly methods = new MethodRegistry();
  private readonly topics = new TopicRegistry();
  private readonly maxDepth: number;
  private depth = 0;
  private destroyed = false;

  constructor(options?: BusOptions) {
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  }

  // -------------------------------------------------------------------------
  // Command API
  // -------------------------------------------------------------------------

  /** Register a method handler. Throws if already registered. */
  registerMethod(method: string, handler: MethodHandler): void {
    this.methods.register(method, handler);
  }

  /** Unregister a method handler. */
  unregisterMethod(method: string): boolean {
    return this.methods.unregister(method);
  }

  /**
   * Dispatch a command envelope through validation, lookup, and execution.
   * Returns a ResponseEnvelope in all cases (never throws).
   */
  async send(envelope: unknown): Promise<ResponseEnvelope> {
    // FR-003: command dispatch pipeline
    if (this.destroyed) {
      return this.errorResponse(envelope, validationError('Bus has been destroyed'));
    }

    // Step 1: validate envelope
    const validation = validateEnvelope(envelope);
    if (!validation.valid) {
      return this.errorResponse(envelope, validation.error);
    }

    const validated: Envelope = validation.envelope;

    // Step 2: assert command type
    if (!isCommand(validated)) {
      return this.errorResponse(
        envelope,
        validationError('Expected a command envelope, got ' + validated.type),
      );
    }

    const command: CommandEnvelope = validated;

    // Step 3: check re-entrant depth
    if (this.depth >= this.maxDepth) {
      return createResponse(
        command,
        null,
        validationError(
          `Re-entrant dispatch depth limit exceeded (max ${String(this.maxDepth)})`,
        ),
      );
    }

    // Step 4: resolve handler
    const handler = this.methods.resolve(command.method);
    if (!handler) {
      return createResponse(command, null, methodNotFound(command.method));
    }

    // Step 5: execute handler with re-entrant tracking and correlation context
    this.depth++;
    try {
      const result: unknown = await correlationStorage.run(
        command.correlation_id,
        async () => handler(command),
      );

      // Verify handler returned a valid response envelope
      if (!isValidResponse(result)) {
        return createResponse(
          command,
          null,
          handlerError(command.method, new Error('Handler returned a non-envelope value')),
        );
      }

      return result;
    } catch (err: unknown) {
      return createResponse(command, null, handlerError(command.method, err));
    } finally {
      this.depth--;
    }
  }

  // -------------------------------------------------------------------------
  // Event API
  // -------------------------------------------------------------------------

  /** Subscribe to a topic. Returns an unsubscribe function. */
  subscribe(topic: string, subscriber: TopicSubscriber): () => void {
    return this.topics.subscribe(topic, subscriber);
  }

  /**
   * Publish an event to all topic subscribers.
   * Fire-and-forget: errors in subscribers are logged, not propagated.
   */
  async publish(envelope: unknown): Promise<void> {
    // FR-004: event fan-out
    if (this.destroyed) return;

    // Step 1: validate
    const validation = validateEnvelope(envelope);
    if (!validation.valid) {
      console.error('[bus] Invalid event envelope:', validation.error.message);
      return;
    }

    const validated = validation.envelope;

    // Step 2: assert event type
    if (!isEvent(validated)) {
      console.error('[bus] publish() called with non-event envelope type:', validated.type);
      return;
    }

    let event: EventEnvelope = validated;

    // Inherit correlation_id from active context if not explicitly set
    const activeCorr = getActiveCorrelationId();
    if (activeCorr !== undefined && event.correlation_id.startsWith('cor_')) {
      // Auto-generated correlation — inherit from command context
      event = { ...event, correlation_id: activeCorr };
    }

    // Assign sequence number
    const seq = this.topics.nextSequence(event.topic);
    const sequencedEvent: EventEnvelope = { ...event, sequence: seq };

    // Step 3: snapshot subscribers before iteration (FR-010)
    const subscribers = this.topics.subscribers(event.topic);

    // Step 4: no subscribers — return silently
    if (subscribers.length === 0) return;

    // Step 5: fan-out with isolation (FR-009)
    for (let i = 0; i < subscribers.length; i++) {
      const sub = subscribers[i];
      if (!sub) continue;
      try {
        await sub(sequencedEvent);
      } catch (err: unknown) {
        console.error(
          `[bus] Subscriber ${String(i)} on topic "${event.topic}" threw:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  /** Get the active correlation_id (for events created within handlers). */
  getActiveCorrelationId(): string | undefined {
    return getActiveCorrelationId();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Tear down the bus: clear all registrations. */
  destroy(): void {
    this.destroyed = true;
    this.methods.clear();
    this.topics.clear();
    this.depth = 0;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build an error response when we don't have a valid CommandEnvelope.
   * Uses a synthetic envelope shape to carry the error.
   */
  private errorResponse(
    rawEnvelope: unknown,
    error: Readonly<BusError>,
  ): ResponseEnvelope {
    // Try to extract correlation_id from raw input
    const raw = rawEnvelope as Record<string, unknown> | null | undefined;
    const corrId =
      raw && typeof raw === 'object' && typeof raw['correlation_id'] === 'string'
        ? raw['correlation_id']
        : 'unknown';
    const method =
      raw && typeof raw === 'object' && typeof raw['method'] === 'string'
        ? raw['method']
        : 'unknown';

    return {
      id: `res_err_${Date.now().toString(36)}`,
      correlation_id: corrId,
      timestamp: performance.now(),
      type: 'response',
      method,
      payload: null,
      error,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a new LocalBus instance. */
export function createBus(options?: BusOptions): LocalBus {
  return new LocalBus(options);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidResponse(value: unknown): value is ResponseEnvelope {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj['type'] === 'response' && typeof obj['id'] === 'string';
}
