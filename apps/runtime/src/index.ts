import type { AuditSink } from "./audit/sink";
import { InMemoryLocalBus } from "./protocol/bus";

type RuntimeOptions = {
  auditSink?: AuditSink;
};

export function createRuntime(options: RuntimeOptions = {}) {
  const bus = new InMemoryLocalBus({ auditSink: options.auditSink });
  return {
    bus,
    getState: () => bus.getState(),
    getEvents: () => bus.getEvents(),
    getAuditRecords: () => bus.getAuditRecords()
  };
}
