/**
 * Binding Lifecycle Event Emission
 *
 * Emits events for all binding state changes: bound, rebound, unbound, validation_failed.
 * Events are published via the internal bus for downstream consumers.
 */

import type { ProtocolBus as LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";
const uuidv4 = () => crypto.randomUUID();
import type { BindingTriple, TerminalBinding } from "./binding_triple.js";

// Event topics
export const BINDING_TOPICS = {
  bound: "terminal.binding.bound",
  rebound: "terminal.binding.rebound",
  unbound: "terminal.binding.unbound",
  validationFailed: "terminal.binding.validation_failed",
} as const;

export type BindingEventTopic = (typeof BINDING_TOPICS)[keyof typeof BINDING_TOPICS];

export interface BindingEventPayload extends Record<string, unknown> {
  terminalId: string;
  binding: BindingTriple;
  previousBinding?: BindingTriple;
  state: string;
  timestamp: string;
  correlationId: string;
  reason?: string;
}

/**
 * Emits binding lifecycle events on the internal bus.
 *
 * Publishes events with structured payloads for downstream consumers:
 * - UI state updates
 * - Audit logging
 * - Orphan detection
 * - Binding lifecycle tracking
 */
export class BindingEventEmitter {
  constructor(private bus: LocalBus) {}

  /**
   * Emit event for a terminal binding state change.
   */
  private async emitEvent(topic: BindingEventTopic, payload: BindingEventPayload): Promise<void> {
    const event: LocalBusEnvelope = {
      id: uuidv4(),
      type: "event" as const,
      ts: new Date().toISOString(),
      topic,
      // biome-ignore lint/style/useNamingConvention: bus envelope protocol is snake_case.
      terminal_id: payload.terminalId,
      // biome-ignore lint/style/useNamingConvention: bus envelope protocol is snake_case.
      lane_id: payload.binding.laneId,
      // biome-ignore lint/style/useNamingConvention: bus envelope protocol is snake_case.
      session_id: payload.binding.sessionId,
      // biome-ignore lint/style/useNamingConvention: bus envelope protocol is snake_case.
      workspace_id: payload.binding.workspaceId,
      payload: { ...payload },
    };

    try {
      await this.bus.publish(event);
    } catch (_error) {
      // Ignore publish failures to keep eventing non-blocking.
    }
  }

  /**
   * Emit 'bound' event when a terminal is registered.
   */
  async emitBound(binding: TerminalBinding, correlationId: string = uuidv4()): Promise<void> {
    await this.emitEvent(BINDING_TOPICS.bound, {
      terminalId: binding.terminalId,
      binding: binding.binding,
      state: binding.state,
      timestamp: new Date(binding.createdAt).toISOString(),
      correlationId,
    });
  }

  /**
   * Emit 'rebound' event when a terminal's binding changes.
   */
  async emitRebound(
    binding: TerminalBinding,
    previousBinding: BindingTriple,
    correlationId: string = uuidv4()
  ): Promise<void> {
    await this.emitEvent(BINDING_TOPICS.rebound, {
      terminalId: binding.terminalId,
      binding: binding.binding,
      previousBinding,
      state: binding.state,
      timestamp: new Date(binding.updatedAt).toISOString(),
      correlationId,
    });
  }

  /**
   * Emit 'unbound' event when a terminal is unregistered.
   */
  async emitUnbound(binding: TerminalBinding, correlationId: string = uuidv4()): Promise<void> {
    await this.emitEvent(BINDING_TOPICS.unbound, {
      terminalId: binding.terminalId,
      binding: binding.binding,
      state: binding.state,
      timestamp: new Date(binding.updatedAt).toISOString(),
      correlationId,
    });
  }

  /**
   * Emit 'validation_failed' event when a binding fails re-validation.
   */
  async emitValidationFailed(
    binding: TerminalBinding,
    reason: string,
    correlationId: string = uuidv4()
  ): Promise<void> {
    await this.emitEvent(BINDING_TOPICS.validationFailed, {
      terminalId: binding.terminalId,
      binding: binding.binding,
      state: binding.state,
      timestamp: new Date(binding.updatedAt).toISOString(),
      correlationId,
      reason,
    });
  }
}
