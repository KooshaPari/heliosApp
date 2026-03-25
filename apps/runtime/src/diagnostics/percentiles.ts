// FR-002: Rolling percentile computation over ring buffer values.

import type { PercentileBucket } from "./types.js";

export const EMPTY_PERCENTILE_BUCKET: PercentileBucket = {
  p50: 0,
  p95: 0,
  p99: 0,
  min: 0,
  max: 0,
  count: 0,
};

type ValueBufferLike = Float64Array | ReadonlyArray<number> | { getValues: () => Float64Array };

/**
 * Compute percentile statistics from a Float64Array of values.
 * Uses the nearest-rank method. Returns undefined if values is empty.
 *
 * The input array is **not** mutated — a sorted copy is created internally.
 */
export function computePercentiles(values: ValueBufferLike): PercentileBucket {
  const source = "getValues" in values ? values.getValues() : values;
  const validValues = Array.from(source).filter((value) => Number.isFinite(value));
  const count = validValues.length;

  if (count === 0) {
    return EMPTY_PERCENTILE_BUCKET;
  }

  // Sort a copy (Float64Array.prototype.sort is in-place).
  const sorted = Float64Array.from(validValues);
  sorted.sort();

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
