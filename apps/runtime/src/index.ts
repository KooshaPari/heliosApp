/**
 * @helios/runtime - Core runtime package for heliosApp.
 *
 * Exports foundational types and a lightweight integration runtime used by
 * the current test suite.
 */

import { InMemoryLocalBus } from "./protocol/bus.js";
import type { LocalBusEnvelope } from "./protocol/types.js";
import { handleRuntimeFetch } from "./runtime/fetch.js";
import { handleRuntimeRequest } from "./runtime/ops.js";
import type {
  HealthCheckResult,
  RuntimeAuditBundle,
  RuntimeAuditRecord,
  RuntimeOptions,
  TerminalBuffer,
} from "./runtime/types.js";
import { RedactionEngine } from "./secrets/redaction-engine.js";
import { getDefaultRules } from "./secrets/redaction-rules.js";
import { RecoveryRegistry } from "./sessions/registry.js";
import type {
  RecoveryBootstrapResult,
  RecoveryMetadata,
  WatchdogScanResult,
} from "./sessions/types.js";

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

const startTime = performance.now();
const _METHOD_SET = new Set<string>(METHODS);

function _normalizePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function redactStructuredValue(value: unknown, key?: string): unknown {
  const normalizedKey = key?.toLowerCase() ?? "";
  const shouldRedactKey =
    normalizedKey.includes("api_key") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("password");

  if (shouldRedactKey && typeof value === "string" && value.length > 0) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map(item => redactStructuredValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactStructuredValue(entryValue, entryKey),
      ])
    );
  }

  return value;
}

function _redactPayload(
  engine: RedactionEngine,
  payload: Record<string, unknown>,
  correlationId: string
): Record<string, unknown> {
  const structured = redactStructuredValue(payload) as Record<string, unknown>;
  const serialized = JSON.stringify(structured);
  const result = engine.redact(serialized, {
    artifactId: `audit-${correlationId}`,
    artifactType: "audit",
    correlationId,
  });
  return JSON.parse(result.redacted) as Record<string, unknown>;
}

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
  };
}

export type RuntimeInstance = ReturnType<typeof createRuntime>;

export function createRuntime(options: RuntimeOptions & { terminalBufferCapBytes?: number } = {}) {
  const bus = new InMemoryLocalBus();
  const recovery = new RecoveryRegistry();
  const redactionEngine = new RedactionEngine();
  redactionEngine.loadRules(getDefaultRules());

  const auditRecords: RuntimeAuditRecord[] = [];
  const terminalBuffers = new Map<string, TerminalBuffer>();
  const terminalBufferCap = options.terminalBufferCapBytes ?? 1024 * 1024;
  let terminalState: "active" | "throttled" = "active";
  let bootstrapResult: RecoveryBootstrapResult | null = null;

  if (options.recovery_metadata) {
    bootstrapResult = recovery.bootstrap(options.recovery_metadata);
  }

  function appendAuditRecord(record: RuntimeAuditRecord): void {
    const enriched = { ...record };
    if (!enriched.recorded_at) {
      enriched.recorded_at = new Date().toISOString();
    }
    auditRecords.push(enriched);
  }

  function getTerminalBuffer(terminalId: string): TerminalBuffer {
    let buffer = terminalBuffers.get(terminalId);
    if (!buffer) {
      buffer = {
        terminal_id: terminalId,
        total_bytes: 0,
        dropped_bytes: 0,
        entries: [],
      };
      terminalBuffers.set(terminalId, buffer);
    }
    return buffer;
  }

  async function request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    return handleRuntimeRequest(
      {
        bus,
        recovery,
        redactionEngine,
        terminalBufferCap,
        terminalBuffers,
        appendAuditRecord,
        getTerminalBuffer,
        getTerminalState: () => terminalState,
        setTerminalState: state => {
          terminalState = state;
        },
      },
      command
    );
  }

  async function fetch(requestInput: Request): Promise<Response> {
    return handleRuntimeFetch(requestInput, request, {
      bus,
      appendAuditRecord,
    });
  }

  function exportAuditBundle(filter?: { correlation_id?: string }): RuntimeAuditBundle {
    const records = filter?.correlation_id
      ? auditRecords.filter(record => record.correlation_id === filter.correlation_id)
      : [...auditRecords];
    return {
      count: records.length,
      records,
      exported_at: new Date().toISOString(),
    };
  }

  return {
    bus: {
      request,
      publish: (event: LocalBusEnvelope) => bus.publish(event),
    },
    fetch,
    exportRecoveryMetadata(): RecoveryMetadata {
      return recovery.snapshot();
    },
    getBootstrapResult(): RecoveryBootstrapResult | null {
      return bootstrapResult;
    },
    bootstrapRecovery(metadata: RecoveryMetadata): RecoveryBootstrapResult {
      bootstrapResult = recovery.bootstrap(metadata);
      return bootstrapResult;
    },
    getOrphanReport(): WatchdogScanResult {
      return recovery.scanForOrphans(new Date().toISOString());
    },
    exportAuditBundle,
    getTerminalBuffer(terminalId: string): TerminalBuffer {
      return getTerminalBuffer(terminalId);
    },
    getState(): any {
      const state: any = { terminal: terminalState };
      const hasSessions = auditRecords.some(r => r.topic === "session.attached");
      if (hasSessions) {
        state.session = "attached";
      }
      return state;
    },
    async spawnTerminal(payload: Record<string, unknown>): Promise<LocalBusEnvelope> {
      return request({
        id: `cmd-spawn-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.spawn",
        payload,
        ...payload,
      } as LocalBusEnvelope);
    },
    async inputTerminal(payload: Record<string, unknown>): Promise<LocalBusEnvelope> {
      return request({
        id: `cmd-input-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.input",
        payload,
        ...payload,
      } as LocalBusEnvelope);
    },
    async resizeTerminal(payload: Record<string, unknown>): Promise<LocalBusEnvelope> {
      return request({
        id: `cmd-resize-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.resize",
        payload,
        ...payload,
      } as LocalBusEnvelope);
    },
    getEvents(): LocalBusEnvelope[] {
      return auditRecords
        .filter(r => r.type === "event")
        .map((r, index) => {
          return {
            ts: r.recorded_at,
            type: "event",
            topic: r.topic,
            correlation_id: r.correlation_id,
            payload: r.payload,
            sequence: index + 1,
          } as LocalBusEnvelope;
        });
    },
    async getAuditRecords(): Promise<any[]> {
      return auditRecords.map(r => ({
        recorded_at: r.recorded_at,
        type: r.type,
        envelope: {
          correlation_id: r.correlation_id,
          topic: r.topic,
          method: r.method,
          payload: r.payload,
        },
      }));
    },
    shutdown(): void {},
  };
}

export type {
  HealthCheckResult,
  RuntimeAuditBundle,
  RuntimeAuditRecord,
  RuntimeOptions,
  TerminalBuffer,
  TerminalBufferEntry,
} from "./runtime/types.js";
