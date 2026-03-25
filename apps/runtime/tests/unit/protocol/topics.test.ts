<<<<<<< HEAD
import { beforeEach, describe, expect, it } from "bun:test";
import { createBus } from "../../../src/protocol/bus.js";
import type { LocalBus } from "../../../src/protocol/bus.js";
import { createEvent } from "../../../src/protocol/envelope.js";
=======
import { describe, expect, it, beforeEach } from "bun:test";
import { createBus } from "../../../src/protocol/bus.js";
import type { LocalBus } from "../../../src/protocol/bus.js";
import { createEvent } from "../../../src/protocol/envelope.js";
import type { LocalBusEnvelope } from "../../../src/protocol/types.js";
>>>>>>> origin/main

// FR-004: Event fan-out with deterministic delivery
// FR-009: Subscriber isolation (one throwing does not block others)
// FR-010: Snapshot-based subscriber iteration

describe("LocalBus — event fan-out", () => {
  let bus: LocalBus;

  beforeEach(() => {
    bus = createBus();
  });

  // FR-004: all subscribers receive event in registration order
  it("delivers events to all subscribers in registration order", async () => {
    const received: number[] = [];

    bus.subscribe("order.test", () => {
      received.push(1);
    });
    bus.subscribe("order.test", () => {
      received.push(2);
    });
    bus.subscribe("order.test", () => {
      received.push(3);
    });

<<<<<<< HEAD
    const evt = createEvent("order.test", "data");
=======
    const evt = createEvent("order.test", { data: "data" }) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    expect(received).toEqual([1, 2, 3]);
  });

  // FR-009: subscriber isolation — throwing subscriber doesn't block others
  it("isolates subscriber errors: sub 2 throws, subs 1 and 3 still receive", async () => {
    const received: number[] = [];

    bus.subscribe("isolation.test", () => {
      received.push(1);
    });
    bus.subscribe("isolation.test", () => {
      throw new Error("sub 2 explodes");
    });
    bus.subscribe("isolation.test", () => {
      received.push(3);
    });

<<<<<<< HEAD
    const evt = createEvent("isolation.test", null);
=======
    const evt = createEvent("isolation.test", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    expect(received).toEqual([1, 3]);
  });

  // FR-004: no subscribers — no error
  it("publishes to topic with no subscribers without error", async () => {
<<<<<<< HEAD
    const evt = createEvent("empty.topic", null);
=======
    const evt = createEvent("empty.topic", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    // Should not throw
    await bus.publish(evt);
  });

  // FR-010: snapshot prevents mutation during iteration
  it("uses snapshot: unsubscribe during iteration does not affect delivery", async () => {
    const received: number[] = [];
<<<<<<< HEAD
    let unsub2: (() => void) | undefined;
=======
    const unsubscribers: Array<() => void> = [];
>>>>>>> origin/main

    bus.subscribe("snapshot.test", () => {
      received.push(1);
      // Subscriber 1 unsubscribes subscriber 2 during iteration
<<<<<<< HEAD
      if (unsub2) {
        unsub2();
      }
    });
    unsub2 = bus.subscribe("snapshot.test", () => {
      received.push(2);
    });
=======
      if (unsubscribers[0]) {
        unsubscribers[0]();
      }
    });
    unsubscribers.push(
      bus.subscribe("snapshot.test", () => {
        received.push(2);
      })
    );
>>>>>>> origin/main
    bus.subscribe("snapshot.test", () => {
      received.push(3);
    });

<<<<<<< HEAD
    const evt = createEvent("snapshot.test", null);
=======
    const evt = createEvent("snapshot.test", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    // All 3 should receive because snapshot was taken before iteration
    expect(received).toEqual([1, 2, 3]);
  });

  it("unsubscribe removes only the target subscriber", async () => {
    const received: number[] = [];

    bus.subscribe("unsub.test", () => {
      received.push(1);
    });
    const unsub = bus.subscribe("unsub.test", () => {
      received.push(2);
    });
    bus.subscribe("unsub.test", () => {
      received.push(3);
    });

    unsub();

<<<<<<< HEAD
    const evt = createEvent("unsub.test", null);
=======
    const evt = createEvent("unsub.test", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    expect(received).toEqual([1, 3]);
  });

  it("unsubscribe called twice is a no-op", () => {
<<<<<<< HEAD
    const unsub = bus.subscribe("double.unsub", () => {});
=======
    const unsub = bus.subscribe("double.unsub", () => {
      // Intentionally no-op callback for unsubscribe semantics test.
    });
>>>>>>> origin/main
    unsub();
    unsub(); // should not throw
  });

  it("same function subscribed twice creates independent subscriptions", async () => {
    const received: number[] = [];
    const handler = () => {
      received.push(1);
    };

    bus.subscribe("dupe.test", handler);
    bus.subscribe("dupe.test", handler);

<<<<<<< HEAD
    const evt = createEvent("dupe.test", null);
=======
    const evt = createEvent("dupe.test", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    expect(received).toEqual([1, 1]);
  });

  it("silently discards invalid event envelope", async () => {
    // Should not throw, just log
<<<<<<< HEAD
    await bus.publish({ garbage: true });
=======
    await bus.publish({ garbage: true } as unknown as LocalBusEnvelope);
>>>>>>> origin/main
  });

  it("silently discards non-event envelope passed to publish", async () => {
    const cmd = {
      id: "cmd_123",
<<<<<<< HEAD
      correlation_id: "cor_123",
      timestamp: 1,
      type: "command",
      method: "test",
      payload: null,
    };
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixture intentionally uses snake_case.
      correlation_id: "cor_123",
      timestamp: 1,
      type: "command" as const,
      method: "test",
      payload: {},
    } satisfies LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(cmd);
  });

  // FR-004: async subscribers awaited sequentially
  it("awaits async subscribers sequentially in order", async () => {
    const received: number[] = [];

    bus.subscribe("async.order", async () => {
      await new Promise(r => setTimeout(r, 10));
      received.push(1);
    });
<<<<<<< HEAD
    bus.subscribe("async.order", async () => {
      received.push(2);
    });

    const evt = createEvent("async.order", null);
=======
    bus.subscribe("async.order", () => {
      received.push(2);
    });

    const evt = createEvent("async.order", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    // 1 should come before 2 because subscribers are awaited sequentially
    expect(received).toEqual([1, 2]);
  });

  it("assigns incrementing sequence numbers to events", async () => {
    const sequences: number[] = [];

    bus.subscribe("seq.test", evt => {
<<<<<<< HEAD
      sequences.push(evt.sequence);
    });

    await bus.publish(createEvent("seq.test", null));
    await bus.publish(createEvent("seq.test", null));
    await bus.publish(createEvent("seq.test", null));
=======
      sequences.push(evt.sequence!);
    });

    await bus.publish(createEvent("seq.test", undefined) as LocalBusEnvelope);
    await bus.publish(createEvent("seq.test", undefined) as LocalBusEnvelope);
    await bus.publish(createEvent("seq.test", undefined) as LocalBusEnvelope);
>>>>>>> origin/main

    expect(sequences).toEqual([1, 2, 3]);
  });

  it("destroy clears all subscriptions", async () => {
    const received: number[] = [];
    bus.subscribe("destroy.test", () => {
      received.push(1);
    });
    bus.destroy();

<<<<<<< HEAD
    const evt = createEvent("destroy.test", null);
=======
    const evt = createEvent("destroy.test", undefined) as LocalBusEnvelope;
>>>>>>> origin/main
    await bus.publish(evt);

    expect(received).toEqual([]);
  });
});
