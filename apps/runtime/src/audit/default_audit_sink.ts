import type { AuditEvent } from "./event.ts";
import { AuditRingBuffer } from "./ring-buffer.ts";
import type { AuditSink, AuditSinkMetrics, AuditStorage } from "./sink_types.ts";

export class DefaultAuditSink implements AuditSink {
  private buffer: AuditEvent[] = [];
  private readonly ringBuffer: AuditRingBuffer;
  private readonly maxRetries = 5;
  private readonly retryBackoffMs = 100;
  private flushTimer: number | null = null;
  private persistenceInProgress = false;
  private overflowQueue: AuditEvent[] = [];

  private metrics: AuditSinkMetrics = {
    totalEventsWritten: 0,
    bufferHighWaterMark: 0,
    persistenceFailures: 0,
    retryCount: 0,
    eventsOverflowed: 0,
    sqliteWriteFailures: 0,
    sqliteRetryCount: 0,
  };

  constructor(
    private readonly storage: AuditStorage,
    ringBufferCapacity = 10_000
  ) {
    this.ringBuffer = new AuditRingBuffer(ringBufferCapacity);
    this.startPeriodicFlush();
  }

  async write(event: AuditEvent): Promise<void> {
    this.metrics.totalEventsWritten++;
    const evicted = this.ringBuffer.push(event);
    if (evicted) {
      this.metrics.eventsOverflowed = (this.metrics.eventsOverflowed ?? 0) + 1;
      this.overflowQueue.push(evicted);
    }

    this.buffer.push(event);
    this.metrics.bufferHighWaterMark = Math.max(
      this.metrics.bufferHighWaterMark,
      this.buffer.length
    );

    if (this.buffer.length >= 10_000) {
      void this.flush();
    }
    if (this.overflowQueue.length > 0) {
      void this.persistOverflow();
    }
  }

  async flush(): Promise<void> {
    if (this.persistenceInProgress || this.buffer.length === 0) {
      return;
    }

    this.persistenceInProgress = true;
    const batch = [...this.buffer];
    try {
      await this.persistWithRetry(batch);
      this.buffer.splice(0, batch.length);
    } finally {
      this.persistenceInProgress = false;
    }
  }

  getBufferedCount(): number {
    return this.buffer.length;
  }

  getMetrics(): AuditSinkMetrics {
    return { ...this.metrics };
  }

  destroy(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, 10_000) as unknown as number;
  }

  private async persistOverflow(): Promise<void> {
    if (this.overflowQueue.length === 0) {
      return;
    }
    const overflow = [...this.overflowQueue];
    try {
      await this.persistWithRetry(overflow);
      this.overflowQueue.splice(0, overflow.length);
    } catch {
      // Leave queue intact for later retry via flush/next write.
    }
  }

  private async persistWithRetry(events: AuditEvent[]): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        await this.storage.persist(events);
        return;
      } catch (error) {
        attempt += 1;
        this.metrics.persistenceFailures += 1;
        this.metrics.retryCount += 1;
        this.metrics.sqliteWriteFailures = (this.metrics.sqliteWriteFailures ?? 0) + 1;
        this.metrics.sqliteRetryCount = (this.metrics.sqliteRetryCount ?? 0) + 1;
        if (attempt >= this.maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.retryBackoffMs * attempt));
      }
    }
  }
}

export class NoOpAuditStorage implements AuditStorage {
  async persist(_events: AuditEvent[]): Promise<void> {}
}
