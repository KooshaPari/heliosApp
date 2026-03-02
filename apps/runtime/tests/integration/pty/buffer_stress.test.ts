/**
 * Stress test — overflow with 50MB output into 4MB buffer.
 *
 * Verifies:
 * - Capacity is never exceeded
 * - Drops are correctly counted
 * - Overflow events are emitted
 * - Event loop remains responsive
 */

import { describe, expect, it } from "bun:test";
import { OutputBuffer } from "../../../src/pty/buffers.js";
import { InMemoryBusPublisher } from "../../../src/pty/events.js";
import type { PtyEventCorrelation } from "../../../src/pty/events.js";

function makeCorrelation(): PtyEventCorrelation {
  return {
    ptyId: "pty-stress-1",
    laneId: "lane-1",
    sessionId: "session-1",
    terminalId: "term-1",
    correlationId: "corr-stress-1",
  };
}

describe("Buffer stress test — 50MB into 4MB buffer", () => {
  it("handles 50MB of output without exceeding capacity", () => {
    const origWarn = console.warn;
    console.warn = () => {};

    try {
      const bus = new InMemoryBusPublisher();
      const capacity = 4 * 1024 * 1024; // 4MB
      const ob = new OutputBuffer(bus, makeCorrelation(), {
        capacityBytes: capacity,
        overflowDebounceMs: 0, // allow all overflow events for testing
      });

      const totalData = 50 * 1024 * 1024; // 50MB
      const chunkSize = 64 * 1024; // 64KB chunks
      const chunk = new Uint8Array(chunkSize);
      // Fill chunk with recognizable pattern.
      for (let i = 0; i < chunkSize; i++) {
        chunk[i] = i & 0xff;
      }

      let totalWritten = 0;
      let totalDropped = 0;

      const startTime = performance.now();
      let lastResponsivenessCheck = startTime;
      let maxTimeBetweenChecks = 0;

      for (let offset = 0; offset < totalData; offset += chunkSize) {
        const result = ob.write(chunk);
        totalWritten += result.written;
        totalDropped += result.dropped;

        // Verify capacity invariant on every write.
        expect(ob.available).toBeLessThanOrEqual(capacity);

        // Track event loop responsiveness.
        const now = performance.now();
        const delta = now - lastResponsivenessCheck;
        if (delta > maxTimeBetweenChecks) {
          maxTimeBetweenChecks = delta;
        }
        lastResponsivenessCheck = now;

        // Periodically consume a small amount to simulate a slow reader.
        if (offset % (4 * 1024 * 1024) === 0 && ob.available > 0) {
          ob.consume(Math.min(ob.available, 64 * 1024));
        }
      }

      const elapsedMs = performance.now() - startTime;

      // ── Assertions ──────────────────────────────────────────────

      // 1. Total written + dropped = total data.
      expect(totalWritten + totalDropped).toBe(totalData);

      // 2. Drops were counted (buffer is 4MB, wrote 50MB with periodic drain).
      expect(totalDropped).toBeGreaterThan(0);

      // 3. Buffer never exceeded capacity.
      expect(ob.available).toBeLessThanOrEqual(capacity);

      // 4. Stats match.
      const stats = ob.getStats();
      expect(stats.totalWritten).toBe(totalWritten);
      expect(stats.totalDropped).toBe(totalDropped);
      expect(stats.capacity).toBe(capacity);

      // 5. Overflow events were emitted.
      const overflowEvts = bus.events.filter(e => e.topic === "pty.buffer.overflow");
      expect(overflowEvts.length).toBeGreaterThan(0);
      expect(stats.overflowEvents).toBeGreaterThan(0);

      // 6. Event loop stayed responsive — no single iteration > 100ms.
      expect(maxTimeBetweenChecks).toBeLessThan(100);

      // 7. Completed in reasonable time (< 10 seconds for 50MB).
      expect(elapsedMs).toBeLessThan(10_000);
    } finally {
      console.warn = origWarn;
    }
  });

  it("handles continuous overflow without consuming", () => {
    const origWarn = console.warn;
    console.warn = () => {};

    try {
      const bus = new InMemoryBusPublisher();
      const capacity = 4 * 1024 * 1024;
      const ob = new OutputBuffer(bus, makeCorrelation(), {
        capacityBytes: capacity,
        overflowDebounceMs: 0,
      });

      const chunkSize = 128 * 1024;
      const chunk = new Uint8Array(chunkSize);
      const iterations = 500; // ~62.5MB

      for (let i = 0; i < iterations; i++) {
        ob.write(chunk);
        expect(ob.available).toBeLessThanOrEqual(capacity);
      }

      const stats = ob.getStats();
      const totalData = chunkSize * iterations;
      expect(stats.totalWritten + stats.totalDropped).toBe(totalData);
      // After first fill, almost everything should be dropped.
      expect(stats.totalDropped).toBeGreaterThan(totalData - capacity - chunkSize);
      expect(stats.overflowEvents).toBeGreaterThan(0);

      // Backpressure should be active.
      expect(ob.isBackpressured).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });
});
