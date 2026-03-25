/**
 * Ring Buffer (Fixed-Capacity Circular Buffer)
 *
 * A high-performance, fixed-capacity buffer that overwrites oldest entries
 * when full. Backed by typed arrays for efficient memory usage.
 *
 * @example
 * ```typescript
 * const buffer = new RingBuffer<number>(1000);
 * buffer.push(42, Date.now());
 * const values = buffer.getValues(); // Float64Array
 * ```
 */

const DEFAULT_CAPACITY = 10_000;

export interface RingBufferOptions {
  /** Maximum number of samples to store. Default: 10,000 */
  capacity?: number;
}

/**
 * Fixed-capacity ring buffer backed by typed arrays.
 *
 * Memory per buffer: `2 * capacity * 8` bytes (two Float64Arrays).
 * For the default 10,000 capacity that is ~160 KB.
 *
 * @typeParam T - The numeric type for values (default: number)
 */
export class RingBuffer<T extends number = number> {
  private readonly _values: Float64Array;
  private readonly _timestamps: Float64Array;
  private readonly _capacity: number;
  private writeIndex = 0;
  private _count = 0;
  private _overflow = 0;

  /**
   * Create a new ring buffer with the specified capacity.
   * @param options - Configuration options or just a number for capacity
   * @throws {RangeError} if capacity is not a positive number
   */
  constructor(options: RingBufferOptions | number = {}) {
    const capacity = typeof options === "number" ? options : (options.capacity ?? DEFAULT_CAPACITY);
    if (capacity <= 0 || !Number.isFinite(capacity)) {
      throw new RangeError("RingBuffer capacity must be a positive number");
    }
    this._capacity = Math.floor(capacity);
    this._values = new Float64Array(this._capacity);
    this._timestamps = new Float64Array(this._capacity);
  }

  /** Maximum capacity of this buffer. */
  get capacity(): number {
    return this._capacity;
  }

  /** Number of valid samples currently stored (up to capacity). */
  get length(): number {
    return this._count;
  }

  /**
   * Append a sample to the buffer.
   * Overwrites the oldest entry when full.
   *
   * @param value - The numeric value to record
   * @param timestamp - Optional timestamp (defaults to 0)
   */
  push(value: T, timestamp = 0): void {
    if (this._count >= this._capacity) {
      this._overflow++;
    }
    this._values[this.writeIndex] = value;
    this._timestamps[this.writeIndex] = timestamp;
    this.writeIndex = (this.writeIndex + 1) % this._capacity;
    if (this._count < this._capacity) {
      this._count++;
    }
  }

  /**
   * Return a view of valid value entries in insertion order.
   *
   * The returned Float64Array is a **copy** (to provide correct ordering
   * when the buffer has wrapped).
   *
   * @returns Float64Array of values in insertion order
   */
  getValues(): Float64Array {
    if (this._count === 0) {
      return new Float64Array(0);
    }
    if (this._count < this._capacity) {
      // No wrap yet — return a slice of the underlying buffer.
      return this._values.slice(0, this._count);
    }
    // Buffer has wrapped — stitch oldest..end + start..writeIndex.
    const result = new Float64Array(this._capacity);
    const tailLen = this._capacity - this.writeIndex;
    result.set(this._values.subarray(this.writeIndex, this.writeIndex + tailLen), 0);
    result.set(this._values.subarray(0, this.writeIndex), tailLen);
    return result;
  }

  /**
   * Return a view of valid timestamp entries in insertion order.
   *
   * @returns Float64Array of timestamps in insertion order
   */
  getTimestamps(): Float64Array {
    if (this._count === 0) {
      return new Float64Array(0);
    }
    if (this._count < this._capacity) {
      return this._timestamps.slice(0, this._count);
    }
    const result = new Float64Array(this._capacity);
    const tailLen = this._capacity - this.writeIndex;
    result.set(this._timestamps.subarray(this.writeIndex, this.writeIndex + tailLen), 0);
    result.set(this._timestamps.subarray(0, this.writeIndex), tailLen);
    return result;
  }

  /**
   * Return all elements in insertion order as a plain array.
   * Alias for getValues() converted to number array.
   */
  toArray(): number[] {
    return Array.from(this.getValues());
  }

  /** Number of valid samples currently stored (up to capacity). */
  getCount(): number {
    return this._count;
  }

  /** Number of oldest samples that were overwritten. */
  getOverflowCount(): number {
    return this._overflow;
  }

  /** Check if the buffer is at capacity. */
  isFull(): boolean {
    return this._count >= this._capacity;
  }

  /** Check if the buffer is empty. */
  isEmpty(): boolean {
    return this._count === 0;
  }

  /** Reset the buffer to empty state. */
  clear(): void {
    this.writeIndex = 0;
    this._count = 0;
    this._overflow = 0;
  }
}
