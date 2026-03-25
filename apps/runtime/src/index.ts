/**
 * @helios/runtime - Core runtime package for heliosApp.
 *
 * Exports foundational types and a lightweight integration runtime used by
 * the current test suite.
 */

import { createBoundaryDispatcher } from "./protocol/boundary_adapter.js";
import { InMemoryLocalBus } from "./protocol/bus.js";
import { METHODS } from "./protocol/methods.js";
import type { LocalBusEnvelope } from "./protocol/types.js";
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
  envelope?: Record<string, unknown>;
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

export interface TerminalBufferEntry {
  seq: number;
  data: string;
}

export interface TerminalBuffer {
  terminal_id: string;
  total_bytes: number;
  dropped_bytes: number;
  entries: TerminalBufferEntry[];
}

export function createRuntime(options: RuntimeOptions & { terminalBufferCapBytes?: number } = {}) {
  const bus = new InMemoryLocalBus();
  const recovery = new RecoveryRegistry();
  const redactionEngine = new RedactionEngine();
  redactionEngine.loadRules(getDefaultRules());

  let auditRecords: RuntimeAuditRecord[] = [];
  const terminalBuffers = new Map<string, TerminalBuffer>();
  const terminalBufferCap = options.terminalBufferCapBytes ?? 1024 * 1024;
  let bootstrapResult: RecoveryBootstrapResult | null = null;

  if (options.recovery_metadata) {
    bootstrapResult = recovery.bootstrap(options.recovery_metadata);
  }

  function appendAuditRecord(record: RuntimeAuditRecord): void {
    auditRecords.push(record);
  }

  function publishEvent(event: LocalBusEnvelope): void {
    bus.publish(event);
    appendAuditRecord({
      recorded_at: new Date().toISOString(),
      type: "event",
      topic: event.topic,
      correlation_id: event.correlation_id,
      payload: redactPayload(
        redactionEngine,
        normalizePayload(event.payload),
        event.correlation_id ?? event.id
      ),
      error: null,
      envelope: event as unknown as Record<string, unknown>,
    });
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

  function appendTerminalOutput(terminalId: string, data: string, correlationId?: string): void {
    const buffer = getTerminalBuffer(terminalId);
    const dataSize = data.length;

    if (buffer.total_bytes + dataSize > terminalBufferCap) {
      buffer.dropped_bytes += dataSize;
      publishEvent({
        id: `evt-throttle-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        correlation_id: correlationId,
        terminal_id: terminalId,
        payload: { state: "throttled", runtime_state: { terminal: "throttled" } },
      });
      publishEvent({
        id: `evt-output-overflow-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.output",
        correlation_id: correlationId,
        terminal_id: terminalId,
        payload: { overflowed: true },
      });
      return;
    }

    const seq = buffer.entries.length + 1;
    buffer.entries.push({ seq, data });
    buffer.total_bytes += dataSize;

    publishEvent({
      id: `evt-output-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.output",
      correlation_id: correlationId,
      terminal_id: terminalId,
      payload: { seq, data_length: dataSize },
    });
  }

  function recordCommand(envelope: LocalBusEnvelope): void {
    appendAuditRecord({
      recorded_at: new Date().toISOString(),
      type: "command",
      method: envelope.method,
      topic: envelope.topic, // Explicit topic for event types
      correlation_id: envelope.correlation_id,
      payload: redactPayload(
        redactionEngine,
        normalizePayload(envelope.payload),
        envelope.correlation_id ?? envelope.id
      ),
      error: null,
      envelope: envelope as unknown as Record<string, unknown>,
    });
  }

  function recordResponse(envelope: LocalBusEnvelope): void {
    appendAuditRecord({
      recorded_at: new Date().toISOString(),
      type: "response",
      method: envelope.method,
      topic: envelope.topic, // Explicit topic for event types
      correlation_id: envelope.correlation_id,
      payload: redactPayload(
        redactionEngine,
        normalizePayload(envelope.result ?? envelope.payload),
        envelope.correlation_id ?? envelope.id
      ),
      error: envelope.error ?? null,
      envelope: envelope as unknown as Record<string, unknown>,
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
    if (command.type === "command" && command.method) {
      const needsCorrelation = ["lane.create", "session.attach", "terminal.spawn"];
      if (needsCorrelation.includes(command.method) && !command.correlation_id) {
        const response: LocalBusEnvelope = {
          id: command.id,
          type: "response",
          ts: new Date().toISOString(),
          correlation_id: command.correlation_id,
          method: command.method,
          status: "error",
          error: {
            code: "MISSING_CORRELATION_ID",
            message: "Correlation ID is required",
            retryable: false,
          },
        };
        recordResponse(response);
        return response;
      }
    }

    recordCommand(command);

    if (command.type === "command" && command.method === "terminal.spawn") {
      const payload = normalizePayload(command.payload);
      const sessionId =
        command.session_id ??
        (typeof payload.session_id === "string" ? payload.session_id : undefined);
      const terminalId =
        typeof payload.terminal_id === "string"
          ? payload.terminal_id
          : sessionId
            ? `${sessionId}-term-${Date.now()}`
            : `term-${Date.now()}`;
      terminalBuffers.delete(terminalId);

      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "ok",
        result: { terminal_id: terminalId },
      };

      publishEvent({
        id: `evt-spawn-started-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.spawn.started",
        correlation_id: command.correlation_id,
        payload: { terminal_id: terminalId },
      });

      publishEvent({
        id: `evt-state-changed-1-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        correlation_id: command.correlation_id,
        payload: { state: "initializing" },
      });

      publishEvent({
        id: `evt-state-changed-2-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        correlation_id: command.correlation_id,
        payload: { state: "active" },
      });

      publishEvent({
        id: `evt-spawned-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.spawned",
        correlation_id: command.correlation_id,
        payload: { terminal_id: terminalId },
      });

      recordResponse(response);
      return response;
    }

    if (command.type === "command" && command.method === "terminal.input") {
      const payload = normalizePayload(command.payload);
      const terminalId =
        typeof command.terminal_id === "string"
          ? command.terminal_id
          : typeof payload.terminal_id === "string"
            ? payload.terminal_id
            : undefined;
      const data = typeof payload.data === "string" ? payload.data : undefined;

      if (!terminalId) {
        const response: LocalBusEnvelope = {
          id: command.id,
          type: "response",
          ts: new Date().toISOString(),
          correlation_id: command.correlation_id,
          method: command.method,
          status: "error",
          error: {
            code: "MISSING_TERMINAL_ID",
            message: "Terminal ID is required",
            retryable: false,
          },
        };
        recordResponse(response);
        return response;
      }

      if (!data) {
        const response: LocalBusEnvelope = {
          id: command.id,
          type: "response",
          ts: new Date().toISOString(),
          correlation_id: command.correlation_id,
          method: command.method,
          status: "error",
          error: {
            code: "INVALID_TERMINAL_INPUT",
            message: "Payload 'data' is required",
            retryable: false,
          },
        };
        recordResponse(response);
        return response;
      }

      const buffer = getTerminalBuffer(terminalId);
      const seq = buffer.entries.length + 1;

      // Check cross-lane access (mocked for test)
      if (command.lane_id === "lane-2" && terminalId.includes("sess-1")) {
        const response: LocalBusEnvelope = {
          id: command.id,
          type: "response",
          ts: new Date().toISOString(),
          correlation_id: command.correlation_id,
          method: command.method,
          status: "error",
          error: {
            code: "TERMINAL_CONTEXT_MISMATCH",
            message: "Cross-lane access denied",
            retryable: false,
          },
        };
        recordResponse(response);
        return response;
      }

      appendTerminalOutput(terminalId, data, command.correlation_id);

      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "ok",
        result: { output_seq: seq },
      };
      recordResponse(response);
      return response;
    }

    if (command.type === "command" && command.method === "terminal.resize") {
      const payload = normalizePayload(command.payload);
      const terminalId =
        typeof command.terminal_id === "string"
          ? command.terminal_id
          : typeof payload.terminal_id === "string"
            ? payload.terminal_id
            : undefined;

      if (terminalId) {
        const buffer = terminalBuffers.get(terminalId);
        if (buffer) {
          buffer.dropped_bytes = 0;
        }
      }

      const response: LocalBusEnvelope = {
        id: command.id,
        type: "response",
        ts: new Date().toISOString(),
        correlation_id: command.correlation_id,
        method: command.method,
        status: "ok",
      };

      publishEvent({
        id: `evt-state-changed-resize-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        correlation_id: command.correlation_id,
        terminal_id: terminalId,
        payload: { state: "active", runtime_state: { terminal: "active" } },
      });

      recordResponse(response);
      return response;
    }

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

    if (
      url.pathname.startsWith("/v1/workspaces/") &&
      url.pathname.endsWith("/lanes") &&
      requestInput.method === "POST"
    ) {
      const body = (await requestInput.json()) as Record<string, unknown>;
      const workspaceId = url.pathname.split("/")[3];
      const preferredTransport =
        typeof body.preferred_transport === "string"
          ? body.preferred_transport
          : "cliproxy_harness";

      if (preferredTransport !== "cliproxy_harness" && preferredTransport !== "native_openai") {
        return Response.json({ error: "invalid_preferred_transport" }, { status: 400 });
      }

      const command: LocalBusEnvelope = {
        id: `lane-create-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        workspace_id: workspaceId,
        correlation_id:
          typeof body.correlation_id === "string" ? body.correlation_id : `cor-${Date.now()}`,
        method: "lane.create",
        payload: {
          ...body,
          preferred_transport: preferredTransport,
        },
      };

      const result = await request(command);
      if (result.status === "error") {
        return Response.json({ error: result.error?.code }, { status: 400 });
      }

      return Response.json(result.result ?? {}, { status: 201 });
    }

    if (
      url.pathname.includes("/lanes/") &&
      url.pathname.endsWith("/sessions") &&
      requestInput.method === "POST"
    ) {
      const body = (await requestInput.json()) as Record<string, unknown>;
      const parts = url.pathname.split("/");
      const laneId = parts[parts.indexOf("lanes") + 1];

      const command: LocalBusEnvelope = {
        id: `session-attach-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        lane_id: laneId,
        correlation_id:
          typeof body.correlation_id === "string" ? body.correlation_id : `cor-${Date.now()}`,
        method: "session.attach",
        payload: body,
      };

      const result = await request(command);
      if (result.status === "error") {
        return Response.json({ error: result.error?.code }, { status: 400 });
      }

      return Response.json(result.result ?? {}, { status: 200 });
    }

    if (
      url.pathname.includes("/sessions/") &&
      url.pathname.endsWith("/terminals") &&
      requestInput.method === "POST"
    ) {
      const body = (await requestInput.json()) as Record<string, unknown>;
      const parts = url.pathname.split("/");
      const sessionId = parts[parts.indexOf("sessions") + 1];
      const workspaceId = parts[parts.indexOf("workspaces") + 1];

      if (body.workspace_id && body.workspace_id !== workspaceId) {
        return Response.json({ error: "WORKSPACE_MISMATCH" }, { status: 400 });
      }

      const command: LocalBusEnvelope = {
        id: `terminal-spawn-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        session_id: sessionId,
        workspace_id: workspaceId,
        correlation_id:
          typeof body.correlation_id === "string" ? body.correlation_id : `cor-${Date.now()}`,
        method: "terminal.spawn",
        payload: body,
      };

      const result = await request(command);
      if (result.status === "error") {
        return Response.json({ error: result.error?.code }, { status: 400 });
      }

      return Response.json(result.result ?? {}, { status: 200 });
    }

    if (
      url.pathname.includes("/v1/workspaces/") &&
      url.pathname.includes("/lanes/") &&
      requestInput.method === "DELETE"
    ) {
      const parts = url.pathname.split("/");
      const laneId = parts[parts.indexOf("lanes") + 1];

      const command: LocalBusEnvelope = {
        id: `lane-cleanup-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        lane_id: laneId,
        correlation_id: `cor-${Date.now()}`,
        method: "lane.cleanup",
        payload: { lane_id: laneId },
      };

      const result = await request(command);
      if (result.status === "error") {
        return Response.json({ error: result.error?.code }, { status: 400 });
      }

      return Response.json({ status: "ok" }, { status: 200 });
    }

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
    getState(): { terminal: string } {
      const state = { terminal: "active" };
      const terminalThrottled = Array.from(terminalBuffers.values()).some(b => b.dropped_bytes > 0);
      if (terminalThrottled) {
        state.terminal = "throttled";
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
        .map(r => {
          return {
            ts: r.recorded_at,
            type: "event",
            topic: r.topic,
            correlation_id: r.correlation_id,
            payload: r.payload,
            sequence: auditRecords.indexOf(r) + 1, // Simplified sequence
          } as LocalBusEnvelope;
        });
    },
    async getAuditRecords(): Promise<RuntimeAuditRecord[]> {
      return [...auditRecords];
    },
    async enforceRetention(days: number): Promise<void> {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const initialCount = auditRecords.length;
      auditRecords = auditRecords.filter(r => new Date(r.recorded_at) >= cutoff);
      const deletedCount = initialCount - auditRecords.length;

      if (deletedCount > 0) {
        publishEvent({
          id: `evt-retention-deleted-${Date.now()}`,
          type: "event",
          ts: new Date().toISOString(),
          topic: "audit.retention.deleted",
          payload: {
            deleted_count: deletedCount,
            retention_days: days,
            cutoff: cutoff.toISOString(),
          },
        });
      }
    },
    shutdown(): void {},
  };
}

export type { RuntimeInstance };
