/**
 * Canonical envelope types for the Helios local bus protocol.
 *
 * Every bus message conforms to one of three discriminated shapes:
 * CommandEnvelope, ResponseEnvelope, or EventEnvelope.
 */

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Fields shared by all envelope types. */
export interface EnvelopeBase {
  /** Unique message identifier (spec-005 format: {prefix}_{ulid}). */
  readonly id: string;
  /** Correlation identifier linking related messages. */
  readonly correlation_id: string;
  /** Monotonic timestamp (milliseconds). */
  readonly timestamp: number;
  /** Optional ordering sequence; required on events. */
  readonly sequence?: number;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export interface CommandEnvelope extends EnvelopeBase {
  readonly type: 'command';
  readonly method: string;
  readonly payload: unknown;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

import type { BusError } from './errors.js';

export interface ResponseEnvelope extends EnvelopeBase {
  readonly type: 'response';
  readonly method: string;
  readonly payload: unknown;
  readonly error?: BusError;
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface EventEnvelope extends EnvelopeBase {
  readonly type: 'event';
  readonly topic: string;
  readonly payload: unknown;
  /** Sequence is required on events (assigned by topic registry at publish time). */
  readonly sequence: number;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/** Union of all valid envelope shapes. */
export type Envelope = CommandEnvelope | ResponseEnvelope | EventEnvelope;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Narrow an envelope to CommandEnvelope. */
export function isCommand(e: Envelope): e is CommandEnvelope {
  return e.type === 'command';
}

/** Narrow an envelope to ResponseEnvelope. */
export function isResponse(e: Envelope): e is ResponseEnvelope {
  return e.type === 'response';
}

/** Narrow an envelope to EventEnvelope. */
export function isEvent(e: Envelope): e is EventEnvelope {
  return e.type === 'event';
}
