import type { GhosttySurface } from "./surface.js";

export class GhosttyStreamManager {
  private readonly streams = new Map<string, ReadableStreamDefaultReader<Uint8Array>>();
  private readonly streamAbortControllers = new Map<string, AbortController>();
  private readonly streamPumpPromises = new Map<string, Promise<void>>();
  private readonly pipingLatencies = new Map<string, number[]>();

  constructor(
    private readonly surface: GhosttySurface,
    private readonly writeToGhostty: (ptyId: string, data: Uint8Array) => Promise<void>,
    private readonly notifyStreamEnd: (ptyId: string) => void,
    private readonly notifyPaneRemoved: (ptyId: string) => void,
  ) {}

  bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void {
    if (this.streams.has(ptyId)) {
      this.unbindStream(ptyId);
    }

    const controller = new AbortController();
    const reader = stream.getReader();
    this.streams.set(ptyId, reader);
    this.streamAbortControllers.set(ptyId, controller);
    this.pipingLatencies.set(ptyId, []);

    const pumpPromise = this._pumpStream(ptyId, reader, controller.signal);
    this.streamPumpPromises.set(ptyId, pumpPromise);
  }

  unbindStream(ptyId: string): void {
    const controller = this.streamAbortControllers.get(ptyId);
    if (controller !== undefined) {
      controller.abort();
      this.streamAbortControllers.delete(ptyId);
    }

    const reader = this.streams.get(ptyId);
    if (reader !== undefined) {
      void reader.cancel().catch(() => {});
      this.streams.delete(ptyId);
    }

    this.streamPumpPromises.delete(ptyId);
    this.pipingLatencies.delete(ptyId);
    this.notifyPaneRemoved(ptyId);
  }

  teardownAll(): void {
    for (const ptyId of [...this.streams.keys()]) {
      this.unbindStream(ptyId);
    }
  }

  getBoundStreamCount(): number {
    return this.streams.size;
  }

  getBoundStreamIds(): string[] {
    return [...this.streams.keys()];
  }

  getPipingLatencies(ptyId: string): readonly number[] {
    return this.pipingLatencies.get(ptyId) ?? [];
  }

  handleInput(ptyId: string, data: Uint8Array): void {
    void ptyId;
    void data;
  }

  resize(ptyId: string, cols: number, rows: number): void {
    void ptyId;
    void cols;
    void rows;

    if (this.surface.isBound()) {
      const current = this.surface.getSurface();
      if (current !== undefined) {
        this.surface.resize(current.bounds);
      }
    }
  }

  private async _pumpStream(
    ptyId: string,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      while (!signal.aborted) {
        const readStart = Date.now();
        const { done, value } = await reader.read();
        if (done) {
          this.notifyStreamEnd(ptyId);
          break;
        }

        await this.writeToGhostty(ptyId, value);

        const writeEnd = Date.now();
        const latency = writeEnd - readStart;
        const latencies = this.pipingLatencies.get(ptyId);
        if (latencies !== undefined) {
          latencies.push(latency);
          if (latencies.length > 1_000) {
            latencies.shift();
          }
        }
      }
    } catch {
      // Stream cancelled or aborted -- expected during unbind.
    }
  }
}
