// NFR-004: Memory overhead test — 20 metrics x 10k samples must stay under 10 MB.

<<<<<<< HEAD
import { describe, expect, it } from "bun:test";
=======
import { describe, it, expect } from "bun:test";
>>>>>>> origin/main
import { MetricsRegistry } from "../../../src/diagnostics/metrics.js";

describe("Memory Overhead", () => {
  it("20 metrics x 10k samples stays under 10 MB", () => {
    // Force GC before measurement if available.
<<<<<<< HEAD
    if (typeof (globalThis as any).Bun !== "undefined" && typeof (Bun as any).gc === "function") {
      (Bun as any).gc(true);
=======
    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
>>>>>>> origin/main
    }

    const heapBefore = process.memoryUsage().heapUsed;

    const registry = new MetricsRegistry();
<<<<<<< HEAD
    const metricCount = 20;
    const bufferSize = 10_000;

    for (let i = 0; i < metricCount; i++) {
=======
    const METRIC_COUNT = 20;
    const BUFFER_SIZE = 10_000;

    for (let i = 0; i < METRIC_COUNT; i++) {
>>>>>>> origin/main
      registry.register({
        name: `mem-metric-${i}`,
        type: "latency",
        unit: "ms",
        description: `Memory test metric ${i}`,
<<<<<<< HEAD
        bufferSize: bufferSize,
=======
        bufferSize: BUFFER_SIZE,
>>>>>>> origin/main
      });
    }

    // Fill all buffers completely.
<<<<<<< HEAD
    for (let i = 0; i < metricCount; i++) {
      for (let j = 0; j < bufferSize; j++) {
=======
    for (let i = 0; i < METRIC_COUNT; i++) {
      for (let j = 0; j < BUFFER_SIZE; j++) {
>>>>>>> origin/main
        registry.record(`mem-metric-${i}`, Math.random() * 1000, j);
      }
    }

<<<<<<< HEAD
    if (typeof (globalThis as any).Bun !== "undefined" && typeof (Bun as any).gc === "function") {
      (Bun as any).gc(true);
=======
    if (typeof globalThis.Bun !== "undefined" && typeof Bun.gc === "function") {
      Bun.gc(true);
>>>>>>> origin/main
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const totalBytes = heapAfter - heapBefore;
<<<<<<< HEAD
    const totalMb = totalBytes / (1024 * 1024);

    // Expected: 20 * 10k * 16 bytes = ~3.2 MB + overhead
    const _perMetricKb = totalBytes / metricCount / 1024;

    expect(totalMb).toBeLessThan(10);
  });

  it("empty buffers have near-zero overhead", () => {
    if (typeof (globalThis as any).Bun !== "undefined" && typeof (Bun as any).gc === "function") {
      (Bun as any).gc(true);
=======
    const totalMB = totalBytes / (1024 * 1024);

    // Expected: 20 * 10k * 16 bytes = ~3.2 MB + overhead
    const perMetricKB = totalBytes / METRIC_COUNT / 1024;

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
>>>>>>> origin/main
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

<<<<<<< HEAD
    if (typeof (globalThis as any).Bun !== "undefined" && typeof (Bun as any).gc === "function") {
      (Bun as any).gc(true);
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const totalKb = (heapAfter - heapBefore) / 1024;

    // Empty (lazy) buffers should use very little memory.
    expect(totalKb).toBeLessThan(100);
=======
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
    expect(totalKB).toBeLessThan(100);
>>>>>>> origin/main
  });
});
