/**
 * Metric Aggregator
 *
 * Provides statistical aggregation functions for metric samples.
 */

/**
 * Result of aggregating a set of samples.
 */
export interface AggregationResult {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  p50?: number;
  p90?: number;
  p95?: number;
  p99?: number;
  stdDev?: number;
  [key: string]: number | undefined; // Allow dynamic percentile access
}

/**
 * Percentile configuration.
 */
export interface PercentileOptions {
  /** Array of percentiles to calculate (e.g., [50, 90, 95, 99]) */
  percentiles?: number[];
  /** Interpolate between values for more accurate percentiles */
  interpolate?: boolean;
}

/**
 * Statistics calculator for numeric samples.
 *
 * @example
 * ```typescript
 * const stats = new Aggregator([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
 * const result = stats.aggregate();
 * // { count: 10, sum: 55, mean: 5.5, min: 1, max: 10, p50: 5.5, ... }
 * ```
 */
export class Aggregator {
  private readonly samples: Float64Array;
  private cachedSorted: Float64Array | null = null;

  /**
   * Create a new aggregator from an array or Float64Array.
   */
  constructor(samples: ArrayLike<number>) {
    this.samples = samples instanceof Float64Array ? samples : Float64Array.from(samples);
  }

  /**
   * Get the count of samples.
   */
  getCount(): number {
    return this.samples.length;
  }

  /**
   * Get the sum of all samples.
   */
  getSum(): number {
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      sum += this.samples[i];
    }
    return sum;
  }

  /**
   * Get the mean (average) of all samples.
   */
  getMean(): number {
    if (this.samples.length === 0) return 0;
    return this.getSum() / this.samples.length;
  }

  /**
   * Get the minimum value.
   */
  getMin(): number {
    if (this.samples.length === 0) return 0;
    let min = this.samples[0];
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i] < min) min = this.samples[i];
    }
    return min;
  }

  /**
   * Get the maximum value.
   */
  getMax(): number {
    if (this.samples.length === 0) return 0;
    let max = this.samples[0];
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i] > max) max = this.samples[i];
    }
    return max;
  }

  /**
   * Get sorted copy of samples (cached).
   */
  private getSorted(): Float64Array {
    if (this.cachedSorted === null) {
      this.cachedSorted = Float64Array.from(this.samples).sort();
    }
    return this.cachedSorted;
  }

  /**
   * Get percentiles from the samples.
   *
   * @param percentiles - Array of percentiles to calculate (e.g., [50, 90, 99])
   * @param interpolate - Whether to interpolate between values
   */
  getPercentiles(percentiles: number[], interpolate = true): Map<number, number> {
    const result = new Map<number, number>();

    if (this.samples.length === 0) {
      for (const p of percentiles) {
        result.set(p, 0);
      }
      return result;
    }

    const sorted = this.getSorted();
    const len = sorted.length;

    for (const p of percentiles) {
      if (p <= 0) {
        result.set(p, sorted[0] ?? 0);
        continue;
      }
      if (p >= 100) {
        result.set(p, sorted[len - 1] ?? 0);
        continue;
      }

      if (interpolate) {
        // Linear interpolation for more accurate percentile
        const idx = (p / 100) * (len - 1);
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        const fraction = idx - lower;
        const lowerVal = sorted[lower] ?? 0;
        const upperVal = sorted[upper] ?? lowerVal;
        result.set(p, lowerVal * (1 - fraction) + upperVal * fraction);
      } else {
        // Nearest rank method
        const idx = Math.ceil((p / 100) * len) - 1;
        result.set(p, sorted[Math.max(0, idx)] ?? 0);
      }
    }
    return result;
  }

  /**
   * Get standard deviation.
   */
  getStdDev(): number {
    if (this.samples.length === 0) return 0;
    const mean = this.getMean();
    let sumSquaredDiff = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const diff = this.samples[i] - mean;
      sumSquaredDiff += diff * diff;
    }
    return Math.sqrt(sumSquaredDiff / this.samples.length);
  }

  /**
   * Aggregate all statistics into a result object.
   */
  aggregate(options: PercentileOptions = {}): AggregationResult {
    const result: AggregationResult = {
      count: this.getCount(),
      sum: this.getSum(),
      mean: this.getMean(),
      min: this.getMin(),
      max: this.getMax(),
    };

    const percentiles = options.percentiles ?? [50, 90, 95, 99];
    const pResults = this.getPercentiles(percentiles, options.interpolate ?? true);

    for (const [p, value] of pResults) {
      result[`p${p}`] = value;
    }

    if (this.samples.length > 1) {
      result.stdDev = this.getStdDev();
    }

    return result;
  }
}

/**
 * Helper function to aggregate an array of samples.
 */
export function aggregate(
  samples: ArrayLike<number>,
  options?: PercentileOptions
): AggregationResult {
  return new Aggregator(samples).aggregate(options);
}

/**
 * Helper to get common percentiles (p50, p90, p95, p99).
 */
export function getPercentiles(samples: ArrayLike<number>): Map<number, number> {
  return new Aggregator(samples).getPercentiles([50, 90, 95, 99]);
}
