import type { EventEnvelope, LocalBusEnvelope, ResponseEnvelope } from "./types.js";
import type { MethodHandler } from "./methods.js";
import type { LocalBus } from "./bus_contract.js";
import type { AuditRecord, BusState, MetricsReport } from "./bus_in_memory_types.js";
import {
  appendAcceptedEvent,
  getMetricsReport,
  getSequence,
  type InMemoryBusContext,
} from "./bus_in_memory_support.js";
import { publishInMemoryEvent } from "./bus_in_memory_support.js";
import { handleInMemoryRequest } from "./bus_in_memory_runtime.js";

export class InMemoryLocalBus implements LocalBus {
  private readonly context: InMemoryBusContext;

  constructor() {
    this.context = {
      auditLog: [],
      eventLog: [],
      lifecycleProgress: new Map(),
      metricsAccumulator: new Map(),
      metricSamples: [],
      rendererEngineRef: { current: "ghostty" },
      stateRef: { current: { session: "detached" } },
    };
  }

  getEvents(): LocalBusEnvelope[] {
    return [...this.context.eventLog];
  }

  clearEvents(): void {
    this.context.eventLog.length = 0;
  }

  pushEvent(event: LocalBusEnvelope): void {
    const sequencedEvent = event as LocalBusEnvelope & { sequence?: number };
    if (sequencedEvent.sequence === undefined) {
      sequencedEvent.sequence = getSequence(this.context) + 1;
    }
    appendAcceptedEvent(this.context, event);
  }

  getAuditRecords(): Promise<AuditRecord[]> {
    return Promise.resolve([...this.context.auditLog]);
  }

  getMetricsReport(): MetricsReport {
    return getMetricsReport(this.context);
  }

  getState(): BusState {
    return { ...this.context.stateRef.current };
  }

  async publish(event: unknown): Promise<void> {
    await publishInMemoryEvent(this.context, event);
  }

  async request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    return handleInMemoryRequest(this.context, command);
  }

  registerMethod(_method: string, _handler: MethodHandler): void {
    // InMemoryLocalBus only models the lifecycle/request surface for runtime tests.
  }

  async send(envelope: unknown): Promise<ResponseEnvelope> {
    return (await this.request(envelope as LocalBusEnvelope)) as ResponseEnvelope;
  }

  subscribe(_topic: string, _handler: (evt: EventEnvelope) => void | Promise<void>): () => void {
    return () => {};
  }

  destroy(): void {
    this.context.lifecycleProgress.clear();
  }

  getActiveCorrelationId(): string | undefined {
    return undefined;
  }
}
