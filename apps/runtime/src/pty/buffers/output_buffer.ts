/**
 * Output buffer wrapping a ring buffer with backpressure signaling and overflow telemetry.
 */

import type { BusPublisher, PtyEventCorrelation } from "../events.js";
import { emitPtyEvent } from "../events.js";
import { RingBuffer, type RingWriteResult } from "./ring_buffer.js";

export interface BufferStats {
  readonly totalWritten: number;
  readonly totalDropped: number;
  readonly overflowEvents: number;
  readonly capacity: number;
  readonly currentSize: number;
  readonly utilization: number;
}

export interface OutputBufferConfig {
  capacityBytes?: number;
  backpressureThreshold?: number;
  hysteresisBand?: number;
  overflowDebounceMs?: number;
}

export class OutputBuffer {
  private readonly ring: RingBuffer;
  private readonly bus: BusPublisher;
  private readonly correlation: PtyEventCorrelation;
  private readonly backpressureThreshold: number;
  private readonly hysteresisLow: number;
  private readonly overflowDebounceMs: number;
  private backpressureActive = false;
  private _totalWritten = 0;
  private _totalDropped = 0;
  private _overflowEvents = 0;
  private lastOverflowEventTs = 0;
  private firstOverflowLogged = false;

  constructor(bus: BusPublisher, correlation: PtyEventCorrelation, config?: OutputBufferConfig) {
    const capacity = config?.capacityBytes ?? 4 * 1024 * 1024;
    this.ring = new RingBuffer(capacity);
    this.bus = bus;
    this.correlation = correlation;
    this.backpressureThreshold = config?.backpressureThreshold ?? 0.75;
    this.hysteresisLow = this.backpressureThreshold - (config?.hysteresisBand ?? 0.1);
    this.overflowDebounceMs = config?.overflowDebounceMs ?? 1000;
  }

  write(data: Uint8Array): RingWriteResult {
    const result = this.ring.write(data);

    this._totalWritten += result.written;
    this._totalDropped += result.dropped;

    if (result.dropped > 0) {
      this.handleOverflow(result.dropped);
    }

    this.checkBackpressure();

    return result;
  }

  consume(count?: number): Uint8Array {
    const result = this.ring.consume(count);
    this.checkBackpressure();
    return result;
  }

  peek(count?: number): Uint8Array {
    return this.ring.peek(count);
  }

  get available(): number {
    return this.ring.available;
  }

  get capacity(): number {
    return this.ring.capacity;
  }

  get utilization(): number {
    return this.ring.utilization;
  }

  get isBackpressured(): boolean {
    return this.backpressureActive;
  }

  clear(): void {
    this.ring.clear();
    if (this.backpressureActive) {
      this.backpressureActive = false;
      this.emitBackpressureOff();
    }
  }

  getStats(): BufferStats {
    return {
      totalWritten: this._totalWritten,
      totalDropped: this._totalDropped,
      overflowEvents: this._overflowEvents,
      capacity: this.ring.capacity,
      currentSize: this.ring.available,
      utilization: this.ring.utilization,
    };
  }

  private checkBackpressure(): void {
    const util = this.ring.utilization;

    if (!this.backpressureActive && util >= this.backpressureThreshold) {
      this.backpressureActive = true;
      this.emitBackpressureOn(util);
    } else if (this.backpressureActive && util <= this.hysteresisLow) {
      this.backpressureActive = false;
      this.emitBackpressureOff();
    }
  }

  private emitBackpressureOn(utilization: number): void {
    emitPtyEvent(this.bus, "pty.backpressure.on" as const, this.correlation, {
      ptyId: this.correlation.ptyId,
      laneId: this.correlation.laneId,
      utilization,
      threshold: this.backpressureThreshold,
    });
  }

  private emitBackpressureOff(): void {
    const utilization = this.ring.utilization;
    emitPtyEvent(this.bus, "pty.backpressure.off" as const, this.correlation, {
      ptyId: this.correlation.ptyId,
      laneId: this.correlation.laneId,
      utilization,
      threshold: this.backpressureThreshold,
    });
  }

  private handleOverflow(droppedBytes: number): void {
    if (!this.firstOverflowLogged) {
      this.firstOverflowLogged = true;
    }

    const now = Date.now();
    if (now - this.lastOverflowEventTs >= this.overflowDebounceMs) {
      this.lastOverflowEventTs = now;
      this._overflowEvents++;

      emitPtyEvent(this.bus, "pty.buffer.overflow" as const, this.correlation, {
        ptyId: this.correlation.ptyId,
        laneId: this.correlation.laneId,
        droppedBytes,
        totalWritten: this._totalWritten,
        totalDropped: this._totalDropped,
        overflowEvents: this._overflowEvents,
        utilization: this.ring.utilization,
      });
    }
  }
}
