// NFR-004: Memory overhead test — 20 metrics x 10k samples must stay under 10 MB.

import { describe, expect, it } from "bun:test";
import { MetricsRegistry } from "../../../src/diagnostics/metrics.js";

describe("Memory Overhead", () => {
  it("20 metrics x 10k samples stays under 10 MB", () => {
    // Force GC before measurement if available.
    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
    }

    const heapBefore = process.memoryUsage().heapUsed;

    const registry = new MetricsRegistry();
    const metricCount = 20;
    const bufferSize = 10_000;

    for (let i = 0; i < metricCount; i++) {
      registry.register({
        name: `mem-metric-${i}`,
        type: "latency",
        unit: "ms",
        description: `Memory test metric ${i}`,
        bufferSize: bufferSize,
      });
    }

    // Fill all buffers completely.
    for (let i = 0; i < metricCount; i++) {
      for (let j = 0; j < bufferSize; j++) {
        registry.record(`mem-metric-${i}`, Math.random() * 1000, j);
      }
    }

    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const totalBytes = heapAfter - heapBefore;
    const totalMb = totalBytes / (1024 * 1024);

    // Expected: 20 * 10k * 16 bytes = ~3.2 MB + overhead
    const _perMetricKb = totalBytes / metricCount / 1024;

    console.log(
      JSON.stringify({
        benchmark: "memory-overhead",
        totalMB: Number(totalMB.toFixed(2)),
        perMetricKB: Number(perMetricKB.toFixed(2)),
        metricCount: METRIC_COUNT,
        bufferSize: BUFFER_SIZE,
        expectedMinMB: 3.2,
      })
    );

    expect(totalMB).toBeLessThan(10);
  });

  it("empty buffers have near-zero overhead", () => {
    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
    }

    const heapBefore = process.memoryUsage().heapUsed;

    const registry = new MetricsRegistry();
    for (let i = 0; i < 20; i++) {
      registry.register({
        name: `empty-metric-${i}`,
        type: "latency",
        unit: "ms",
        description: `Empty metric ${i}`,
        bufferSize: 10_000,
      });
    }
    // No samples recorded — buffers are lazily allocated.

    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const totalKB = (heapAfter - heapBefore) / 1024;

    console.log(
      JSON.stringify({
        benchmark: "empty-buffers",
        totalKB: Number(totalKB.toFixed(2)),
      })
    );

    // Empty (lazy) buffers should use very little memory.
    expect(totalKb).toBeLessThan(100);
  });
});
