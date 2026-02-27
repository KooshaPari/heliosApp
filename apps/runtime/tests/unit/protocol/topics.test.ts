import { describe, expect, it, beforeEach } from 'bun:test';
import { createBus, LocalBus } from '../../../src/protocol/bus.js';
import { createEvent } from '../../../src/protocol/envelope.js';
import type { EventEnvelope } from '../../../src/protocol/types.js';

// FR-004: Event fan-out with deterministic delivery
// FR-009: Subscriber isolation (one throwing does not block others)
// FR-010: Snapshot-based subscriber iteration

describe('LocalBus — event fan-out', () => {
  let bus: LocalBus;

  beforeEach(() => {
    bus = createBus();
  });

  // FR-004: all subscribers receive event in registration order
  it('delivers events to all subscribers in registration order', async () => {
    const received: number[] = [];

    bus.subscribe('order.test', () => { received.push(1); });
    bus.subscribe('order.test', () => { received.push(2); });
    bus.subscribe('order.test', () => { received.push(3); });

    const evt = createEvent('order.test', 'data');
    await bus.publish(evt);

    expect(received).toEqual([1, 2, 3]);
  });

  // FR-009: subscriber isolation — throwing subscriber doesn't block others
  it('isolates subscriber errors: sub 2 throws, subs 1 and 3 still receive', async () => {
    const received: number[] = [];

    bus.subscribe('isolation.test', () => { received.push(1); });
    bus.subscribe('isolation.test', () => { throw new Error('sub 2 explodes'); });
    bus.subscribe('isolation.test', () => { received.push(3); });

    const evt = createEvent('isolation.test', null);
    await bus.publish(evt);

    expect(received).toEqual([1, 3]);
  });

  // FR-004: no subscribers — no error
  it('publishes to topic with no subscribers without error', async () => {
    const evt = createEvent('empty.topic', null);
    // Should not throw
    await bus.publish(evt);
  });

  // FR-010: snapshot prevents mutation during iteration
  it('uses snapshot: unsubscribe during iteration does not affect delivery', async () => {
    const received: number[] = [];
    let unsub2: (() => void) | undefined;

    bus.subscribe('snapshot.test', () => {
      received.push(1);
      // Subscriber 1 unsubscribes subscriber 2 during iteration
      if (unsub2) unsub2();
    });
    unsub2 = bus.subscribe('snapshot.test', () => { received.push(2); });
    bus.subscribe('snapshot.test', () => { received.push(3); });

    const evt = createEvent('snapshot.test', null);
    await bus.publish(evt);

    // All 3 should receive because snapshot was taken before iteration
    expect(received).toEqual([1, 2, 3]);
  });

  it('unsubscribe removes only the target subscriber', async () => {
    const received: number[] = [];

    bus.subscribe('unsub.test', () => { received.push(1); });
    const unsub = bus.subscribe('unsub.test', () => { received.push(2); });
    bus.subscribe('unsub.test', () => { received.push(3); });

    unsub();

    const evt = createEvent('unsub.test', null);
    await bus.publish(evt);

    expect(received).toEqual([1, 3]);
  });

  it('unsubscribe called twice is a no-op', () => {
    const unsub = bus.subscribe('double.unsub', () => {});
    unsub();
    unsub(); // should not throw
  });

  it('same function subscribed twice creates independent subscriptions', async () => {
    const received: number[] = [];
    const handler = () => { received.push(1); };

    bus.subscribe('dupe.test', handler);
    bus.subscribe('dupe.test', handler);

    const evt = createEvent('dupe.test', null);
    await bus.publish(evt);

    expect(received).toEqual([1, 1]);
  });

  it('silently discards invalid event envelope', async () => {
    // Should not throw, just log
    await bus.publish({ garbage: true });
  });

  it('silently discards non-event envelope passed to publish', async () => {
    const cmd = {
      id: 'cmd_123',
      correlation_id: 'cor_123',
      timestamp: 1,
      type: 'command',
      method: 'test',
      payload: null,
    };
    await bus.publish(cmd);
  });

  // FR-004: async subscribers awaited sequentially
  it('awaits async subscribers sequentially in order', async () => {
    const received: number[] = [];

    bus.subscribe('async.order', async () => {
      await new Promise((r) => setTimeout(r, 10));
      received.push(1);
    });
    bus.subscribe('async.order', async () => {
      received.push(2);
    });

    const evt = createEvent('async.order', null);
    await bus.publish(evt);

    // 1 should come before 2 because subscribers are awaited sequentially
    expect(received).toEqual([1, 2]);
  });

  it('assigns incrementing sequence numbers to events', async () => {
    const sequences: number[] = [];

    bus.subscribe('seq.test', (evt) => { sequences.push(evt.sequence); });

    await bus.publish(createEvent('seq.test', null));
    await bus.publish(createEvent('seq.test', null));
    await bus.publish(createEvent('seq.test', null));

    expect(sequences).toEqual([1, 2, 3]);
  });

  it('destroy clears all subscriptions', async () => {
    const received: number[] = [];
    bus.subscribe('destroy.test', () => { received.push(1); });
    bus.destroy();

    const evt = createEvent('destroy.test', null);
    await bus.publish(evt);

    expect(received).toEqual([]);
  });
});
