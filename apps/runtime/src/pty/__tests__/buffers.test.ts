import { describe, expect, it, mock } from "bun:test";
import { RingBuffer, OutputBuffer } from "../buffers.js";
import { InMemoryBusPublisher } from "../events.js";

describe("RingBuffer", () => {
  it("writes, wraps, peeks, and consumes data", () => {
    const ring = new RingBuffer(4);

    expect(ring.write(new Uint8Array([1, 2, 3]))).toEqual({
      written: 3,
      dropped: 0,
    });
    expect(ring.peek()).toEqual(new Uint8Array([1, 2, 3]));
    expect(ring.consume(2)).toEqual(new Uint8Array([1, 2]));

    expect(ring.write(new Uint8Array([4, 5, 6]))).toEqual({
      written: 3,
      dropped: 0,
    });
    expect(ring.peek()).toEqual(new Uint8Array([3, 4, 5, 6]));
    expect(ring.consume()).toEqual(new Uint8Array([3, 4, 5, 6]));
  });
});

describe("OutputBuffer", () => {
  it("emits backpressure and overflow telemetry", () => {
    const bus = new InMemoryBusPublisher();
    const warnSpy = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      const buffer = new OutputBuffer(
        bus,
        {
          ptyId: "pty-1",
          laneId: "lane-1",
          sessionId: "session-1",
          terminalId: "term-1",
          correlationId: "corr-1",
        },
        {
          capacityBytes: 4,
          backpressureThreshold: 0.5,
          hysteresisBand: 0.1,
          overflowDebounceMs: 0,
        },
      );

      expect(buffer.write(new Uint8Array([1, 2]))).toEqual({
        written: 2,
        dropped: 0,
      });
      expect(buffer.isBackpressured).toBe(true);
      expect(bus.events.map((event) => event.topic)).toContain(
        "pty.backpressure.on",
      );

      expect(buffer.write(new Uint8Array([3, 4, 5]))).toEqual({
        written: 2,
        dropped: 1,
      });
      expect(bus.events.map((event) => event.topic)).toContain(
        "pty.buffer.overflow",
      );

      buffer.consume(4);
      expect(buffer.isBackpressured).toBe(false);
      expect(bus.events.map((event) => event.topic)).toContain(
        "pty.backpressure.off",
      );
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });
});
