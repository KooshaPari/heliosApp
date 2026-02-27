// FR-002: Unit tests for rolling percentile computation.

import { describe, it, expect } from "bun:test";
import { RingBuffer } from "../../../src/diagnostics/metrics.js";
import { computePercentiles } from "../../../src/diagnostics/percentiles.js";

describe("computePercentiles", () => {
  // FR-002: Known distribution [1..100]
  it("produces correct percentiles for [1..100]", () => {
    const buf = new RingBuffer(200);
    for (let i = 1; i <= 100; i++) {
      buf.push(i, i);
    }
    const result = computePercentiles(buf);
    expect(result.p50).toBe(51);
    expect(result.p95).toBe(96);
    expect(result.p99).toBe(100);
    expect(result.min).toBe(1);
    expect(result.max).toBe(100);
    expect(result.count).toBe(100);
  });

  // FR-002: Empty buffer
  it("returns zeroed bucket for empty buffer", () => {
    const buf = new RingBuffer(10);
    const result = computePercentiles(buf);
    expect(result).toEqual({ p50: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 });
  });

  // FR-002: Single sample
  it("returns that value for all percentiles with single sample", () => {
    const buf = new RingBuffer(10);
    buf.push(42, 1);
    const result = computePercentiles(buf);
    expect(result.p50).toBe(42);
    expect(result.p95).toBe(42);
    expect(result.p99).toBe(42);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.count).toBe(1);
  });

  // FR-002: Two samples
  it("handles two samples correctly", () => {
    const buf = new RingBuffer(10);
    buf.push(10, 1);
    buf.push(20, 2);
    const result = computePercentiles(buf);
    expect(result.min).toBe(10);
    expect(result.max).toBe(20);
    expect(result.p99).toBe(20);
    expect(result.count).toBe(2);
  });

  // FR-002: All identical values
  it("returns same value for all percentiles when values are identical", () => {
    const buf = new RingBuffer(10);
    for (let i = 0; i < 5; i++) buf.push(7, i);
    const result = computePercentiles(buf);
    expect(result.p50).toBe(7);
    expect(result.p95).toBe(7);
    expect(result.p99).toBe(7);
  });

  // FR-002: NaN filtering
  it("filters NaN values before computing", () => {
    const buf = new RingBuffer(10);
    buf.push(10, 1);
    buf.push(NaN, 2);
    buf.push(20, 3);
    const result = computePercentiles(buf);
    expect(result.count).toBe(2);
    expect(result.min).toBe(10);
    expect(result.max).toBe(20);
  });

  // FR-002: All NaN
  it("returns zeroed bucket when all values are NaN", () => {
    const buf = new RingBuffer(10);
    buf.push(NaN, 1);
    buf.push(NaN, 2);
    const result = computePercentiles(buf);
    expect(result.count).toBe(0);
  });

  // FR-002: Sort is on a copy
  it("does not mutate original buffer values", () => {
    const buf = new RingBuffer(10);
    buf.push(30, 1);
    buf.push(10, 2);
    buf.push(20, 3);
    const before = Array.from(buf.getValues());
    computePercentiles(buf);
    const after = Array.from(buf.getValues());
    expect(after).toEqual(before);
  });

  // FR-002: Skewed distribution
  it("handles skewed distribution with one outlier", () => {
    const buf = new RingBuffer(200);
    for (let i = 0; i < 99; i++) buf.push(1, i);
    buf.push(1000, 99);
    const result = computePercentiles(buf);
    expect(result.p50).toBe(1);
    expect(result.max).toBe(1000);
    expect(result.count).toBe(100);
  });
});
