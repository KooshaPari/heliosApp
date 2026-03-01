/**
 * Method registry for the Helios local bus.
 *
 * Provides single-handler binding per method name with strict validation.
 */

import type { CommandEnvelope, ResponseEnvelope } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A method handler receives a command and returns a response (sync or async). */
export type MethodHandler = (
  command: CommandEnvelope,
) => ResponseEnvelope | Promise<ResponseEnvelope>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Method names must be non-empty, alphanumeric with dots. */
const METHOD_NAME_RE = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;

function assertValidMethodName(method: string): void {
  if (!METHOD_NAME_RE.test(method)) {
    throw new Error(
      `Invalid method name "${method}": must be non-empty, alphanumeric segments separated by dots`,
    );
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class MethodRegistry {
  private readonly handlers = new Map<string, MethodHandler>();

  /** Register a handler for a method. Throws if already registered. */
  register(method: string, handler: MethodHandler): void {
    assertValidMethodName(method);
    if (this.handlers.has(method)) {
      throw new Error(`Method "${method}" is already registered`);
    }
    this.handlers.set(method, handler);
  }

  /** Unregister a method. Returns true if it was registered. */
  unregister(method: string): boolean {
    return this.handlers.delete(method);
  }

  /** Look up a handler by method name. */
  resolve(method: string): MethodHandler | undefined {
    return this.handlers.get(method);
  }

  /** List all registered method names. */
  methods(): string[] {
    return [...this.handlers.keys()];
  }

  /** Remove all registrations. */
  clear(): void {
    this.handlers.clear();
  }
}
