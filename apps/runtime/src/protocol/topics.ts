/**
 * Topic registry for the Helios local bus.
 *
 * Manages ordered subscriber lists per topic with deterministic delivery.
 */

import type { EventEnvelope } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A topic subscriber receives an event (return value is ignored). */
export type TopicSubscriber = (event: EventEnvelope) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Topic names must be non-empty, alphanumeric with dots. */
const TOPIC_NAME_RE = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;

function assertValidTopicName(topic: string): void {
  if (!TOPIC_NAME_RE.test(topic)) {
    throw new Error(
      `Invalid topic name "${topic}": must be non-empty, alphanumeric segments separated by dots`,
    );
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class TopicRegistry {
  private readonly subs = new Map<string, TopicSubscriber[]>();
  private readonly sequenceCounters = new Map<string, number>();

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   * Same function subscribed twice creates two independent subscriptions.
   */
  subscribe(topic: string, subscriber: TopicSubscriber): () => void {
    assertValidTopicName(topic);

    let list = this.subs.get(topic);
    if (!list) {
      list = [];
      this.subs.set(topic, list);
    }

    // Use a sentinel wrapper so we can identify this exact subscription.
    const entry: TopicSubscriber = subscriber;
    list.push(entry);

    let removed = false;
    return () => {
      if (removed) return; // idempotent unsubscribe
      removed = true;
      const current = this.subs.get(topic);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx !== -1) {
        current.splice(idx, 1);
      }
      // Clean up empty topic
      if (current.length === 0) {
        this.subs.delete(topic);
        this.sequenceCounters.delete(topic);
      }
    };
  }

  /** Return ordered subscriber list (snapshot — safe for iteration). */
  subscribers(topic: string): TopicSubscriber[] {
    const list = this.subs.get(topic);
    return list ? [...list] : [];
  }

  /** List all topics with at least one subscriber. */
  topics(): string[] {
    return [...this.subs.keys()];
  }

  /** Get the next sequence number for a topic. */
  nextSequence(topic: string): number {
    const current = this.sequenceCounters.get(topic) ?? 0;
    const next = current + 1;
    this.sequenceCounters.set(topic, next);
    return next;
  }

  /** Remove all subscriptions. */
  clear(): void {
    this.subs.clear();
    this.sequenceCounters.clear();
  }
}
