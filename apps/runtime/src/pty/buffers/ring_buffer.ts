/**
 * Fixed-capacity ring buffer backed by a pre-allocated ArrayBuffer.
 */

export interface RingWriteResult {
  readonly written: number;
  readonly dropped: number;
}

export class RingBuffer {
  private readonly buffer: Uint8Array;
  private readonly _capacity: number;
  private head = 0;
  private _size = 0;

  constructor(capacity: number) {
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      throw new Error(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
    this._capacity = capacity;
    this.buffer = new Uint8Array(new ArrayBuffer(capacity));
  }

  get capacity(): number {
    return this._capacity;
  }

  get available(): number {
    return this._size;
  }

  get utilization(): number {
    return this._capacity === 0 ? 0 : this._size / this._capacity;
  }

  write(data: Uint8Array): RingWriteResult {
    const freeSpace = this._capacity - this._size;
    const written = Math.min(data.length, freeSpace);
    const dropped = data.length - written;

    if (written === 0) {
      return { written: 0, dropped };
    }

    const tail = (this.head + this._size) % this._capacity;
    const firstChunk = Math.min(written, this._capacity - tail);
    this.buffer.set(data.subarray(0, firstChunk), tail);

    if (firstChunk < written) {
      this.buffer.set(data.subarray(firstChunk, written), 0);
    }

    this._size += written;
    return { written, dropped };
  }

  peek(count?: number): Uint8Array {
    const n = Math.min(count ?? this._size, this._size);
    if (n === 0) return new Uint8Array(0);

    const result = new Uint8Array(n);
    const firstChunk = Math.min(n, this._capacity - this.head);
    result.set(this.buffer.subarray(this.head, this.head + firstChunk));

    if (firstChunk < n) {
      result.set(this.buffer.subarray(0, n - firstChunk), firstChunk);
    }

    return result;
  }

  consume(count?: number): Uint8Array {
    const result = this.peek(count);
    this.head = (this.head + result.length) % this._capacity;
    this._size -= result.length;
    return result;
  }

  clear(): void {
    this.head = 0;
    this._size = 0;
  }
}
