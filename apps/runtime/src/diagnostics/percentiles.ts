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
  source: Float64Array | ReadonlyArray<number> | ValueBufferLike
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
    p50,
    p95,
    p99,
    min,
    max,
    count,
  };
}

function percentileIndex(count: number, p: number): number {
  return Math.min(count - 1, Math.max(0, Math.ceil(p * (count + 1)) - 1));
}

function quickSelect(values: Float64Array, left: number, right: number, target: number): number {
  let lo = left;
  let hi = right;

  while (lo <= hi) {
    if (lo === hi) {
      return values[lo]!;
    }

    const pivotIndex = partition(values, lo, hi, medianOfThree(values, lo, hi));
    if (pivotIndex === target) {
      return values[pivotIndex]!;
    }
    if (target < pivotIndex) {
      hi = pivotIndex - 1;
    } else {
      lo = pivotIndex + 1;
    }
  }

  return values[target]!;
}

function medianOfThree(values: Float64Array, left: number, right: number): number {
  const mid = left + ((right - left) >> 1);
  const a = values[left]!;
  const b = values[mid]!;
  const c = values[right]!;

  if ((a <= b && b <= c) || (c <= b && b <= a)) {
    return mid;
  }
  if ((b <= a && a <= c) || (c <= a && a <= b)) {
    return left;
  }
  return right;
}

function partition(values: Float64Array, left: number, right: number, pivotIndex: number): number {
  const pivotValue = values[pivotIndex]!;
  swap(values, pivotIndex, right);
  let storeIndex = left;

  for (let i = left; i < right; i++) {
    if (values[i]! < pivotValue) {
      swap(values, storeIndex, i);
      storeIndex++;
    }
  }

  swap(values, storeIndex, right);
  return storeIndex;
}

function swap(values: Float64Array, a: number, b: number): void {
  if (a === b) {
    return;
  }
  const tmp = values[a]!;
  values[a] = values[b]!;
  values[b] = tmp;
}
