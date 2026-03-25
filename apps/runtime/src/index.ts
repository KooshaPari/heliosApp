/**
 * @helios/runtime - Core runtime package for heliosApp.
 *
 * Exports foundational types and a lightweight integration runtime used by
 * the current test suite.
 */

import { InMemoryLocalBus } from "./protocol/bus.js";
<<<<<<< HEAD
=======
import { createBoundaryDispatcher } from "./protocol/boundary_adapter.js";
import { METHODS } from "./protocol/methods.js";
>>>>>>> origin/main
import type { LocalBusEnvelope } from "./protocol/types.js";
import { RecoveryRegistry } from "./sessions/registry.js";
import type {
  RecoveryBootstrapResult,
  RecoveryMetadata,
  WatchdogScanResult,
} from "./sessions/types.js";
import { RedactionEngine } from "./secrets/redaction-engine.js";
import { getDefaultRules } from "./secrets/redaction-rules.js";
<<<<<<< HEAD
import { handleRuntimeRequest } from "./runtime/ops.js";
import { handleRuntimeFetch } from "./runtime/fetch.js";
import type {
  HealthCheckResult,
  RuntimeAuditBundle,
  RuntimeAuditRecord,
  RuntimeOptions,
  TerminalBuffer,
  TerminalBufferEntry,
} from "./runtime/types.js";
=======
>>>>>>> origin/main

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

<<<<<<< HEAD
=======
/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

export type RuntimeAuditRecord = {
  recorded_at: string;
  type: "command" | "response" | "event";
  method?: string;
  topic?: string;
  correlation_id?: string;
  payload: Record<string, unknown>;
  error?: { code: string; message: string; retryable?: boolean } | null;
};

export type RuntimeAuditBundle = {
  count: number;
  records: RuntimeAuditRecord[];
  exported_at: string;
};

export type RuntimeOptions = {
  recovery_metadata?: RecoveryMetadata;
};

type RuntimeInstance = ReturnType<typeof createRuntime>;

>>>>>>> origin/main
const startTime = performance.now();
const METHOD_SET = new Set<string>(METHODS);

function normalizePayload(value: unknown): Record<string, unknown> {
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

function redactPayload(
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

<<<<<<< HEAD
export type RuntimeInstance = ReturnType<typeof createRuntime>;

export function createRuntime(options: RuntimeOptions & { terminalBufferCapBytes?: number } = {}) {
=======
export function createRuntime(options: RuntimeOptions = {}) {
>>>>>>> origin/main
  const bus = new InMemoryLocalBus();
  const recovery = new RecoveryRegistry();
  const redactionEngine = new RedactionEngine();
  redactionEngine.loadRules(getDefaultRules());

  const auditRecords: RuntimeAuditRecord[] = [];
<<<<<<< HEAD
  const terminalBuffers = new Map<string, TerminalBuffer>();
  const terminalBufferCap = options.terminalBufferCapBytes ?? 1024 * 1024;
  let terminalState: "active" | "throttled" = "active";
=======
>>>>>>> origin/main
  let bootstrapResult: RecoveryBootstrapResult | null = null;

  if (options.recovery_metadata) {
    bootstrapResult = recovery.bootstrap(options.recovery_metadata);
  }

  function appendAuditRecord(record: RuntimeAuditRecord): void {
<<<<<<< HEAD
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
      setTerminalState: (state) => {
        terminalState = state;
      },
    },
    command,
  );
  }

  async function fetch(requestInput: Request): Promise<Response> {
    return handleRuntimeFetch(
      requestInput,
      request,
      {
        bus,
        appendAuditRecord,
      },
    );
=======
    auditRecords.push(record);
  }

  function recordCommand(envelope: LocalBusEnvelope): void {
    appendAuditRecord({
      recorded_at: new Date().toISOString(),
      type: "command",
      method: envelope.method,
      correlation_id: envelope.correlation_id,
      payload: redactPayload(
        redactionEngine,
        normalizePayload(envelope.payload),
        envelope.correlation_id ?? envelope.id
      ),
      error: null,
    });
  }

  function recordResponse(envelope: LocalBusEnvelope): void {
    appendAuditRecord({
      recorded_at: new Date().toISOString(),
      type: "response",
      method: envelope.method,
      correlation_id: envelope.correlation_id,
      payload: redactPayload(
        redactionEngine,
        normalizePayload(envelope.result ?? envelope.payload),
        envelope.correlation_id ?? envelope.id
      ),
      error: envelope.error ?? null,
    });
  }

  function applyRecoveryFromCommand(command: LocalBusEnvelope, response: LocalBusEnvelope): void {
    if (response.type !== "response" || response.status !== "ok" || !command.method) {
      return;
    }

    const payload = normalizePayload(command.payload);
    const result = normalizePayload(response.result);

    recovery.apply(command.method, {
      workspace_id: command.workspace_id,
      lane_id:
        command.lane_id ??
        (typeof payload.lane_id === "string" ? payload.lane_id : undefined) ??
        (typeof payload.id === "string" && command.method === "lane.create"
          ? payload.id
          : undefined) ??
        (typeof result.lane_id === "string" ? result.lane_id : undefined),
      session_id:
        command.session_id ??
        (typeof payload.session_id === "string" ? payload.session_id : undefined) ??
        (typeof payload.id === "string" && command.method === "session.attach"
          ? payload.id
          : undefined) ??
        (typeof result.session_id === "string" ? result.session_id : undefined),
      terminal_id:
        command.terminal_id ??
        (typeof payload.terminal_id === "string" ? payload.terminal_id : undefined) ??
        (typeof payload.id === "string" && command.method === "terminal.spawn"
          ? payload.id
          : undefined) ??
        (typeof result.terminal_id === "string" ? result.terminal_id : undefined),
      codex_session_id:
        typeof payload.codex_session_id === "string" ? payload.codex_session_id : undefined,
    });
  }

  async function request(command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    recordCommand(command);

    if (command.type === "command" && command.method && !METHOD_SET.has(command.method)) {
      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "error",
        error: {
          code: "METHOD_NOT_SUPPORTED",
          message: `Unsupported method '${command.method}'`,
          retryable: false,
        },
      };
      recordResponse(response);
      return response;
    }

    if (
      command.type === "command" &&
      command.method === "session.attach" &&
      command.payload?.boundary_failure === "harness"
    ) {
      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "error",
        error: {
          code: "HARNESS_UNAVAILABLE",
          message: "Harness boundary unavailable",
          retryable: false,
        },
      };
      recordResponse(response);
      return response;
    }

    const response = await bus.request(command);
    response.correlation_id ??= command.correlation_id;
    response.method ??= command.method;
    applyRecoveryFromCommand(command, response);
    recordResponse(response);
    return response;
  }

  async function fetch(requestInput: Request): Promise<Response> {
    const url = new URL(requestInput.url);

    if (url.pathname === "/v1/protocol/dispatch" && requestInput.method === "POST") {
      const body = (await requestInput.json()) as Record<string, unknown>;
      const command: LocalBusEnvelope = {
        id: `dispatch-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        workspace_id: typeof body.workspace_id === "string" ? body.workspace_id : undefined,
        correlation_id: typeof body.correlation_id === "string" ? body.correlation_id : undefined,
        method: String(body.method ?? ""),
        payload: normalizePayload(body.payload),
      };

      const dispatcher = createBoundaryDispatcher({
        dispatchLocal: request,
      });
      const result = await dispatcher(command);
      if (result.type !== "response") {
        return Response.json({ error: "invalid_boundary_response" }, { status: 500 });
      }

      if (result.status === "error") {
        const status = result.error?.code === "UNSUPPORTED_BOUNDARY_ADAPTER" ? 409 : 400;
        return Response.json(
          {
            error: result.error?.code ?? "dispatch_error",
            details: result.error?.details ?? null,
          },
          { status }
        );
      }

      return Response.json(result.result ?? {}, { status: 200 });
    }

    return new Response("Not found", { status: 404 });
>>>>>>> origin/main
  }

  function exportAuditBundle(filter?: { correlation_id?: string }): RuntimeAuditBundle {
    const records = filter?.correlation_id
<<<<<<< HEAD
      ? auditRecords.filter((record) => record.correlation_id === filter.correlation_id)
=======
      ? auditRecords.filter(record => record.correlation_id === filter.correlation_id)
>>>>>>> origin/main
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
<<<<<<< HEAD
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
      return auditRecords.filter((r) => r.type === "event").map((r, index) => {
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
              payload: r.payload
          } 
      }));
=======
    async getAuditRecords(): Promise<RuntimeAuditRecord[]> {
      return [...auditRecords];
>>>>>>> origin/main
    },
    shutdown(): void {},
  };
}

<<<<<<< HEAD
export type {
  HealthCheckResult,
  RuntimeAuditRecord,
  RuntimeAuditBundle,
  RuntimeOptions,
  TerminalBuffer,
  TerminalBufferEntry,
} from "./runtime/types.js";
=======
export type { RuntimeInstance };
>>>>>>> origin/main
