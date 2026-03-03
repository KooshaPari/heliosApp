import type { ProtocolBus as LocalBus } from "@helios/runtime/protocol/bus";
import type { LocalBusEnvelope } from "@helios/runtime/protocol/types";

function toProtocolName(value: string): string {
  return value.replace(/[A-Z]/g, "_$&").toLowerCase();
}

function toProtocolValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => toProtocolValue(entry));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return toProtocolRecord(value as Record<string, unknown>);
}

function toProtocolRecord(value: Record<string, unknown>): Record<string, unknown> {
  const protocol: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue === undefined) {
      continue;
    }
    protocol[toProtocolName(key)] = toProtocolValue(rawValue);
  }
  return protocol;
}

export interface ActiveContext {
  workspaceId: string;
  laneId: string;
  sessionId: string;
}

export interface ContextChangeEvent {
  previous: ActiveContext | null;
  current: ActiveContext | null;
}

export interface ContextValidationResult {
  valid: boolean;
  error?: string;
}

type ContextChangeListener = (event: ContextChangeEvent) => void;

/**
 * ActiveContextStore provides a single source of truth for the current
 * workspace/lane/session context. All tabs bind to this store and update
 * atomically on context changes.
 *
 * Design:
 * - Debounces rapid context changes (50ms) to prevent intermediate renders.
 * - Validates contexts before accepting to ensure consistency.
 * - Emits events on the internal bus for context changes and validation failures.
 */
export class ActiveContextStore {
  private currentContext: ActiveContext | null = null;
  private listeners = new Set<ContextChangeListener>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingContext: ActiveContext | null = null;
  private bus: LocalBus | null = null;
  private validator: ((ctx: ActiveContext) => Promise<boolean>) | null = null;

  constructor(bus?: LocalBus) {
    this.bus = bus ?? null;
  }

  /**
   * Set the context validator function. Called before accepting a new context.
   */
  setValidator(validator: (ctx: ActiveContext) => Promise<boolean>): void {
    this.validator = validator;
  }

  /**
   * Get the current active context.
   */
  getContext(): ActiveContext | null {
    return this.currentContext;
  }

  /**
   * Set a new active context. Validates the context and emits a change event.
   * Debounces rapid calls to only emit the final context.
   */
  async setContext(context: ActiveContext | null): Promise<void> {
    // Clear any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.pendingContext = context;

    // Debounce: wait 50ms for any additional changes before committing
    return new Promise(resolve => {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.applyContext(this.pendingContext)
          .then(() => {
            resolve();
          })
          .catch(() => {
            resolve();
          });
      }, 50);
    });
  }

  private async applyContext(contextToSet: ActiveContext | null): Promise<void> {
    this.pendingContext = null;

    if (contextToSet !== null && this.validator) {
      const isValid = await this.validator(contextToSet);
      if (!isValid) {
        await this.publishValidationFailure(contextToSet);
        return;
      }
    }

    const previousContext = this.currentContext;
    this.currentContext = contextToSet;

    const changeEvent: ContextChangeEvent = {
      previous: previousContext,
      current: this.currentContext,
    };

    for (const listener of this.listeners) {
      listener(changeEvent);
    }

    if (this.bus) {
      const event: LocalBusEnvelope = toProtocolRecord({
        id: `context-change-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "context.active.changed",
        payload: changeEvent as unknown as Record<string, unknown>,
        workspaceId: contextToSet?.workspaceId,
        laneId: contextToSet?.laneId,
        sessionId: contextToSet?.sessionId,
      }) as LocalBusEnvelope;

      await this.bus.publish(event);
    }
  }

  private async publishValidationFailure(contextToSet: ActiveContext): Promise<void> {
    if (!this.bus) {
      return;
    }

    const event = {
      id: `validation-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "context.validation.failed",
      payload: { context: contextToSet },
    } as LocalBusEnvelope;

    await this.bus.publish(event);
  }

  /**
   * Clear the current context (set to null).
   */
  async clearContext(): Promise<void> {
    await this.setContext(null);
  }

  /**
   * Register a listener for context change events.
   * Returns an unsubscribe function.
   */
  onContextChange(callback: ContextChangeListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get the number of registered listeners (useful for testing).
   */
  getListenerCount(): number {
    return this.listeners.size;
  }
}

/**
 * Global singleton instance.
 */
let globalContextStore: ActiveContextStore | null = null;

/**
 * Get the global singleton instance.
 */
export function getActiveContextStore(bus?: LocalBus): ActiveContextStore {
  if (!globalContextStore) {
    globalContextStore = new ActiveContextStore(bus);
  }
  return globalContextStore;
}

/**
 * Reset the global singleton (for testing).
 */
export function resetActiveContextStore(): void {
  globalContextStore = null;
}
