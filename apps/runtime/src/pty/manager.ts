import { PtyRegistry } from "./registry.js";
import { PtyLifecycle } from "./state_machine.js";
import { spawnPty } from "./spawn.js";
import type { SpawnOptions } from "./spawn.js";
import type { PtyRecord, ReconciliationSummary } from "./registry.js";
import type { BusPublisher } from "./events.js";
import {
  NoOpBusPublisher,
  emitPtyEvent,
} from "./events.js";
import type { SignalHistoryMap } from "./signals.js";
import {
  resize as resizePty,
  terminate as terminatePty,
  type TerminateOptions,
} from "./signals.js";
import { writeInput } from "./io.js";
import type { ProcessMap } from "./io.js";
import { IdleMonitor, type IdleMonitorConfig } from "./idle_monitor.js";
import {
  OutputBuffer,
  type OutputBufferConfig,
  type BufferStats,
} from "./buffers.js";

/**
 * High-level facade for PTY operations.
 *
 * Wraps the state machine, registry, spawn, I/O, signals, and idle
 * monitoring into a single entry point consumed by upstream specs.
 */
export class PtyManager {
  public readonly registry: PtyRegistry;
  public readonly bus: BusPublisher;
  private readonly lifecycles = new Map<string, PtyLifecycle>();
  private readonly processes: ProcessMap = new Map();
  private readonly signalHistories: SignalHistoryMap = new Map();
  public readonly idleMonitor: IdleMonitor;
  private readonly outputBuffers = new Map<string, OutputBuffer>();
  private readonly bufferConfig: OutputBufferConfig | undefined;

  constructor(
    maxCapacity = 300,
    bus?: BusPublisher,
    idleConfig?: IdleMonitorConfig,
    bufferConfig?: OutputBufferConfig,
  ) {
    this.bufferConfig = bufferConfig;
    this.registry = new PtyRegistry(maxCapacity);
    this.bus = bus ?? new NoOpBusPublisher();
    this.idleMonitor = new IdleMonitor(
      this.registry,
      this.bus,
      this.lifecycles,
      idleConfig,
    );
  }

  async spawn(options: SpawnOptions): Promise<PtyRecord> {
    const result = await spawnPty(options, this.registry);
    const record = result.record;

    const lifecycle = new PtyLifecycle(record.ptyId, "active");
    this.lifecycles.set(record.ptyId, lifecycle);

    const correlation = {
      ptyId: record.ptyId,
      laneId: record.laneId,
      sessionId: record.sessionId,
      terminalId: record.terminalId,
      correlationId: crypto.randomUUID(),
    };

    emitPtyEvent(this.bus, "pty.spawned", correlation, {
      pid: record.pid,
      shell: options.shell ?? "/bin/bash",
      dimensions: record.dimensions,
      spawnLatencyMs: result.spawnLatencyMs,
    });

    emitPtyEvent(this.bus, "pty.state.changed", correlation, {
      from: "idle",
      to: "active",
      reason: "spawn_succeeded",
    });

    this.idleMonitor.recordOutput(record.ptyId);

    const outputBuffer = new OutputBuffer(this.bus, correlation, this.bufferConfig);
    this.outputBuffers.set(record.ptyId, outputBuffer);

    return record;
  }

  registerProcess(
    ptyId: string,
    proc: { readonly stdin: { write(data: Uint8Array | string): number } },
  ): void {
    this.processes.set(ptyId, proc);
  }

  get(ptyId: string): PtyRecord | undefined {
    return this.registry.get(ptyId);
  }

  getByLane(laneId: string): PtyRecord[] {
    return this.registry.getByLane(laneId);
  }

  writeInput(ptyId: string, data: Uint8Array): void {
    const record = this.registry.get(ptyId);
    if (!record) {
      throw new Error(`PTY '${ptyId}' not found`);
    }

    writeInput(record, data, this.processes, this.bus, (id) => {
      const lifecycle = this.lifecycles.get(id);
      if (lifecycle && lifecycle.state === "active") {
        try {
          lifecycle.apply("unexpected_exit");
          this.registry.update(id, { state: "errored" });
        } catch {
          // Already transitioned.
        }
      }
    });
  }

  resize(ptyId: string, cols: number, rows: number): void {
    const record = this.registry.get(ptyId);
    if (!record) {
      throw new Error(`PTY '${ptyId}' not found`);
    }

    resizePty(record, cols, rows, this.registry, this.signalHistories, this.bus);
  }

  async terminate(ptyId: string, options?: TerminateOptions): Promise<void> {
    const record = this.registry.get(ptyId);
    if (!record) {
      return;
    }

    const lifecycle = this.lifecycles.get(ptyId);
    if (!lifecycle) {
      const lc = new PtyLifecycle(ptyId, record.state);
      this.lifecycles.set(ptyId, lc);
    }

    const lc = this.lifecycles.get(ptyId)!;

    await terminatePty(
      record,
      lc,
      this.registry,
      this.signalHistories,
      this.bus,
      options,
    );

    this.lifecycles.delete(ptyId);
    this.processes.delete(ptyId);
    this.outputBuffers.delete(ptyId);
    this.idleMonitor.remove(ptyId);
  }

  recordOutput(ptyId: string): void {
    this.idleMonitor.recordOutput(ptyId);
  }

  startIdleMonitor(): void {
    this.idleMonitor.start();
  }

  stopIdleMonitor(): void {
    this.idleMonitor.stop();
  }

  getOutputBuffer(ptyId: string): OutputBuffer | undefined {
    return this.outputBuffers.get(ptyId);
  }

  getBufferStats(ptyId: string): BufferStats | undefined {
    return this.outputBuffers.get(ptyId)?.getStats();
  }

  async reconcileOrphans(): Promise<ReconciliationSummary> {
    return this.registry.reconcileOrphans();
  }
}
