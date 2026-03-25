// FR-002: Rolling percentile computation over ring buffer values.

import type { PercentileBucket } from "./types.js";

interface ValueBufferLike {
  getValues(): Float64Array;
}

export const EMPTY_PERCENTILE_BUCKET: PercentileBucket = {
  p50: 0,
  p95: 0,
  p99: 0,
  min: 0,
  max: 0,
  count: 0,
};

/**
 * Compute percentile statistics from a Float64Array or RingBuffer-like value source.
 * Uses nearest-rank percentiles and a linear-time selection path instead of full sorting.
 *
 * The input values are never mutated.
 */
export function computePercentiles(
  source: Float64Array | readonly number[] | ValueBufferLike
): PercentileBucket {
  const values =
    source instanceof Float64Array
      ? source
      : Array.isArray(source)
        ? Float64Array.from(source)
        : source.getValues();
  if (values.length === 0) {
    return EMPTY_PERCENTILE_BUCKET;
  }

  const scratch = new Float64Array(values.length);
  let count = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (Number.isNaN(value)) {
      continue;
    }
    scratch[count++] = value;
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  if (count === 0) {
    return EMPTY_PERCENTILE_BUCKET;
  }

  const p50Index = percentileIndex(count, 0.5);
  const p95Index = percentileIndex(count, 0.95);
  const p99Index = percentileIndex(count, 0.99);

  let p50 = quickSelect(scratch, 0, count - 1, p50Index);
  let p95 = p50Index === p95Index ? p50 : quickSelect(scratch, 0, count - 1, p95Index);
  let p99 = p95Index === p99Index ? p95 : quickSelect(scratch, 0, count - 1, p99Index);

  if (p50Index > p95Index) {
    [p50, p95] = [p95, p50];
  }
  if (p95Index > p99Index) {
    [p95, p99] = [p99, p95];
  }
  if (p50Index > p95Index) {
    [p50, p95] = [p95, p50];
  }

  return {
    p50: percentileFromSorted(sorted, 0.5),
    p95: percentileFromSorted(sorted, 0.95),
    p99: percentileFromSorted(sorted, 0.99),
    min: sorted[0]!,
    max: sorted[count - 1]!,
    count,
  };
}

/** Nearest-rank percentile on a pre-sorted Float64Array. */
function percentileFromSorted(sorted: Float64Array, p: number): number {
  const index = Math.ceil(p * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)]!;
}
