// FR-002: Rolling percentile computation over ring buffer contents.

import type { PercentileBucket } from "./types.js";
import type { RingBuffer } from "./metrics.js";

/** Reusable temp array to avoid allocation per computation. */
let tempArray: number[] = [];

/**
 * Compute p50/p95/p99/min/max/count statistics from a RingBuffer.
 *
 * Algorithm: copy valid values, filter NaN, sort, index into sorted array.
 * Performance: < 1ms for 10k samples (sort-based).
 */
export function computePercentiles(buffer: RingBuffer): PercentileBucket {
  const values = buffer.getValues();
  const count = values.length;

  if (count === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 };
  }

  // Copy to temp array, filtering NaN values.
  tempArray.length = 0;
  for (let i = 0; i < count; i++) {
    const v = values[i]!;
    if (!Number.isNaN(v)) {
      tempArray.push(v);
    }
  }

  const validCount = tempArray.length;
  if (validCount === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 };
  }

  tempArray.sort((a, b) => a - b);

  return {
    p50: tempArray[Math.floor(validCount * 0.50)]!,
    p95: tempArray[Math.floor(validCount * 0.95)]!,
    p99: tempArray[Math.floor(validCount * 0.99)]!,
    min: tempArray[0]!,
    max: tempArray[validCount - 1]!,
    count: validCount,
  };
}
