export class NumberRingBuffer {
  private readonly _data: Float64Array;
  private readonly _capacity: number;
  private _head = 0;
  private _size = 0;

  constructor(capacity: number) {
    this._capacity = capacity;
    this._data = new Float64Array(capacity);
  }

  push(value: number): void {
    this._data[this._head] = value;
    this._head = (this._head + 1) % this._capacity;
    if (this._size < this._capacity) {
      this._size++;
    }
  }

  get size(): number {
    return this._size;
  }

  sorted(): Float64Array {
    if (this._size === 0) {
      return new Float64Array(0);
    }

    const out = new Float64Array(this._size);
    if (this._size < this._capacity) {
      out.set(this._data.subarray(0, this._size));
    } else {
      const tailLen = this._capacity - this._head;
      out.set(this._data.subarray(this._head, this._head + tailLen), 0);
      out.set(this._data.subarray(0, this._head), tailLen);
    }
    out.sort();
    return out;
  }

  clear(): void {
    this._head = 0;
    this._size = 0;
  }
}

export function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}
