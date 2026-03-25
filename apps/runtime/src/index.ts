/**
<<<<<<< HEAD
 * @helios/runtime — Core runtime package for heliosApp.
 *
 * Exports foundational types, utilities, and service APIs consumed by all other packages.
 *
 * ## Service Architecture
 *
 * The runtime is organized into four key services, each maintaining clear boundaries
 * and exported through a unified public API:
 *
 * - **PTY Service** (`services/pty`): Pseudo-terminal management
 * - **Renderer Service** (`services/renderer`): UI rendering and switching
 * - **Secrets Service** (`services/secrets`): Credential and sensitive data management
 * - **Lanes Service** (`services/lanes`): Workspace/lane orchestration
 *
 * Import services via: `import { ptyService, rendererService, secretsService, lanesService } from '@helios/runtime/services'`
 */

=======
 * @helios/runtime - Core runtime package for heliosApp.
 *
 * Exports foundational types and a lightweight integration runtime used by
 * the current test suite.
 */

import { InMemoryLocalBus } from "./protocol/bus.js";
import { createBoundaryDispatcher } from "./protocol/boundary_adapter.js";
import { METHODS } from "./protocol/methods.js";
import type { LocalBusEnvelope } from "./protocol/types.js";
import { RecoveryRegistry } from "./sessions/registry.js";
import type {
  RecoveryBootstrapResult,
  RecoveryMetadata,
  WatchdogScanResult,
} from "./sessions/types.js";
import { RedactionEngine } from "./secrets/redaction-engine.js";
import { getDefaultRules } from "./secrets/redaction-rules.js";

>>>>>>> origin/main
/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

<<<<<<< HEAD
const startTime = performance.now();
=======
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
>>>>>>> origin/main

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
<<<<<<< HEAD
  };
}

// Re-export all services as a unified API
export * from "./services/index.js";

import { InMemoryLocalBus } from "./protocol/bus";

interface TerminalRecord {
  terminal_id: string;
  workspace_id: string;
  lane_id: string;
  session_id: string;
  state: "active" | "throttled" | "inactive";
}

interface BufferEntry {
  seq: number;
  data: string;
  bytes: number;
}

interface TerminalBuffer {
  entries: BufferEntry[];
  total_bytes: number;
  dropped_bytes: number;
  cap_bytes: number;
  next_seq: number;
}

export function createRuntime(opts?: Record<string, unknown>): any {
  const bus = new InMemoryLocalBus();
  const terminals = new Map<string, TerminalRecord>();
  const buffers = new Map<string, TerminalBuffer>();
  const bufferCapBytes = (
    typeof opts?.terminalBufferCapBytes === "number" ? opts.terminalBufferCapBytes : 65536
  ) as number;
  let terminalState: "active" | "throttled" | "inactive" | undefined;

  function makeTerminalId(sessionId: string): string {
    return `terminal_${sessionId}_${Date.now()}`;
  }

  async function spawnTerminal(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { command_id, correlation_id, workspace_id, lane_id, session_id, title } =
      params as Record<string, string>;

    const terminalId = makeTerminalId(session_id);

    // Register lifecycle progress
    const response = await bus.request({
      id: command_id || `cmd-${Date.now()}`,
      type: "command",
      ts: new Date().toISOString(),
      method: "terminal.spawn",
      correlation_id,
      workspace_id,
      lane_id,
      session_id,
      payload: {
        session_id,
        terminal_id: terminalId,
        title,
      },
    });

    if (response.status === "ok") {
      const tid = (response as any).result?.terminal_id ?? terminalId;
      terminals.set(tid, {
        terminal_id: tid,
        workspace_id,
        lane_id,
        session_id,
        state: "active",
      });
      // Initialize buffer
      buffers.set(tid, {
        entries: [],
        total_bytes: 0,
        dropped_bytes: 0,
        cap_bytes: bufferCapBytes,
        next_seq: 1,
      });
      terminalState = "active";

      // State change events are emitted by the bus during terminal.spawn handling
    }

    return response as any;
  }

  async function inputTerminal(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { command_id, correlation_id, workspace_id, lane_id, session_id, terminal_id, data } =
      params as Record<string, string>;

    // Validate terminal exists
    const terminal = terminals.get(terminal_id);
    if (!terminal) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: { code: "TERMINAL_NOT_FOUND", message: "Terminal not found", retryable: false },
      };
    }

    // Cross-lane check
    if (terminal.lane_id !== lane_id) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        correlation_id,
        error: {
          code: "TERMINAL_CONTEXT_MISMATCH",
          message: "Terminal does not belong to this lane",
          retryable: false,
        },
      };
    }

    // Validate data
    if (data === undefined || data === null) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: {
          code: "INVALID_TERMINAL_INPUT",
          message: "payload.data is required",
          retryable: false,
        },
      };
    }

    // Buffer management
    const buffer = buffers.get(terminal_id)!;
    const byteLen = new TextEncoder().encode(data).length;
    let overflowed = false;

    if (buffer.total_bytes + byteLen > buffer.cap_bytes) {
      // Overflow: drop oldest entries until we fit or mark as dropped
      const dropped = byteLen - (buffer.cap_bytes - buffer.total_bytes);
      buffer.dropped_bytes += dropped;
      overflowed = true;

      // Evict oldest entries to make room
      while (buffer.total_bytes + byteLen > buffer.cap_bytes && buffer.entries.length > 0) {
        const evicted = buffer.entries.shift()!;
        buffer.total_bytes -= evicted.bytes;
      }

      // If still doesn't fit, truncate
      if (buffer.total_bytes + byteLen > buffer.cap_bytes) {
        buffer.dropped_bytes += byteLen;
      } else {
        const seq = buffer.next_seq++;
        buffer.entries.push({ seq, data, bytes: byteLen });
        buffer.total_bytes += byteLen;
      }
    } else {
      const seq = buffer.next_seq++;
      buffer.entries.push({ seq, data, bytes: byteLen });
      buffer.total_bytes += byteLen;
    }

    const outputSeq = buffer.next_seq - 1;

    // Emit output event
    await bus.publish({
      id: `evt-output-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.output",
      workspace_id,
      lane_id,
      session_id,
      terminal_id,
      correlation_id,
      payload: { data, overflowed, output_seq: outputSeq },
    } as any);

    // If overflowed, emit throttled state change
    if (overflowed) {
      terminal.state = "throttled";
      terminalState = "throttled";

      await bus.publish({
        id: `evt-throttled-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        workspace_id,
        lane_id,
        session_id,
        terminal_id,
        correlation_id,
        payload: { state: "throttled" },
      } as any);
    }

    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      correlation_id,
      result: { output_seq: outputSeq },
    };
  }

  async function resizeTerminal(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const {
      command_id,
      correlation_id,
      workspace_id,
      lane_id,
      session_id,
      terminal_id,
      cols,
      rows,
    } = params as Record<string, any>;

    const terminal = terminals.get(terminal_id);
    if (!terminal) {
      return {
        id: `res-${Date.now()}`,
        type: "response",
        ts: new Date().toISOString(),
        status: "error",
        error: { code: "TERMINAL_NOT_FOUND", message: "Terminal not found", retryable: false },
      };
    }

    // Resize restores terminal to active state if throttled
    if (terminal.state === "throttled") {
      terminal.state = "active";
      terminalState = "active";

      await bus.publish({
        id: `evt-recover-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        workspace_id,
        lane_id,
        session_id,
        terminal_id,
        correlation_id,
        payload: {
          state: "active",
          runtime_state: {
            session: "detached",
            terminal: "active",
          },
        },
      } as any);
    }

    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      correlation_id,
      result: { cols, rows },
    };
  }

  function getTerminalBuffer(terminalId: string): any {
    const buffer = buffers.get(terminalId);
    if (!buffer) {
      return { entries: [], total_bytes: 0, dropped_bytes: 0, cap_bytes: bufferCapBytes };
    }
    return { ...buffer };
  }

  // Wrap bus.request to intercept terminal.spawn and track terminals
  const originalRequest = bus.request.bind(bus);
  bus.request = async (command: any) => {
    const response = await originalRequest(command);
    if (command.method === "terminal.spawn" && response.status === "ok") {
      const tid = (response as any).result?.terminal_id;
      if (tid) {
        terminals.set(tid, {
          terminal_id: tid,
          workspace_id: command.workspace_id || "",
          lane_id: command.lane_id || "",
          session_id: command.session_id || "",
          state: "active",
        });
        // Reset buffer on re-spawn
        buffers.set(tid, {
          entries: [],
          total_bytes: 0,
          dropped_bytes: 0,
          cap_bytes: bufferCapBytes,
          next_seq: 1,
        });
        terminalState = "active";
      }
    }
    // Handle terminal.input validation
    if (command.method === "terminal.input") {
      const tid = command.terminal_id;
      const terminal = terminals.get(tid);
      if (terminal && terminal.lane_id !== command.lane_id) {
        return {
          id: `res-${Date.now()}`,
          type: "response",
          ts: new Date().toISOString(),
          status: "error",
          correlation_id: command.correlation_id,
          error: {
            code: "TERMINAL_CONTEXT_MISMATCH",
            message: "Terminal does not belong to this lane",
            retryable: false,
          },
        };
      }
    }
    return response;
  };

  // HTTP routing state
  const lanes = new Map<
    string,
    { lane_id: string; workspace_id: string; state: "open" | "closed"; session_id?: string }
  >();
  const sessions = new Map<
    string,
    { session_id: string; lane_id: string; transport: string; codex_session_id?: string }
  >();
  const harnessProbe = opts?.harnessProbe as
    | { check(): Promise<{ ok: boolean; reason?: string }> }
    | undefined;
  let harnessStatus: { status: string; degrade_reason: string | null } = {
    status: "available",
    degrade_reason: null,
  };
  let laneCounter = 0;
  let sessionCounter = 0;
  let termCounter = 0;

  async function checkHarness(): Promise<{ transport: string; degrade_reason: string | null }> {
    if (!harnessProbe) {
      return { transport: "cliproxy_harness", degrade_reason: null };
    }
    const result = await harnessProbe.check();
    if (result.ok) {
      harnessStatus = { status: "available", degrade_reason: null };
      return { transport: "cliproxy_harness", degrade_reason: null };
    }
    const prevStatus = harnessStatus.status;
    harnessStatus = { status: "unavailable", degrade_reason: result.reason || "unknown" };
    if (prevStatus !== "unavailable") {
      publishHttpEvent("harness.status.changed", { status: "unavailable", reason: result.reason });
    }
    return { transport: "native_openai", degrade_reason: result.reason || "unknown" };
  }

  function publishHttpEvent(
    topic: string,
    payload: Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    bus.pushEvent({
      id: `evt-http-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload,
      ...(context || {}),
    } as any);
  }

  async function handleFetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Route: POST /v1/workspaces/:ws/lanes
    const lanesMatch = path.match(/^\/v1\/workspaces\/([^/]+)\/lanes$/);
    if (lanesMatch && method === "POST") {
      const workspaceId = lanesMatch[1];
      laneCounter++;
      const laneId = `lane_${laneCounter}`;
      lanes.set(laneId, { lane_id: laneId, workspace_id: workspaceId, state: "open" });

      publishHttpEvent(
        "lane.created",
        { lane_id: laneId },
        {
          workspace_id: workspaceId,
          lane_id: laneId,
          correlation_id: `corr-lane-${laneCounter}`,
        }
      );

      return new Response(JSON.stringify({ lane_id: laneId }), { status: 201 });
    }

    // Route: POST /v1/workspaces/:ws/lanes/:lane/sessions
    const sessionsMatch = path.match(/^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/sessions$/);
    if (sessionsMatch && method === "POST") {
      const _workspaceId = sessionsMatch[1];
      const laneId = sessionsMatch[2];
      const body = (await req.json()) as Record<string, unknown>;

      const lane = lanes.get(laneId);
      if (!lane) {
        return new Response(JSON.stringify({ error: "lane_not_found" }), { status: 404 });
      }

      // Check preferred_transport validity
      const preferredTransport = body.preferred_transport as string | undefined;
      const validTransports = ["cliproxy_harness", "native_openai", undefined];
      if (preferredTransport && !validTransports.includes(preferredTransport)) {
        return new Response(JSON.stringify({ error: "invalid_preferred_transport" }), {
          status: 400,
        });
      }

      // Check for existing session (idempotent)
      if (lane.session_id) {
        const existing = sessions.get(lane.session_id);
        if (existing) {
          return new Response(
            JSON.stringify({
              session_id: existing.session_id,
              transport: existing.transport,
              status: "attached",
              codex_session_id: body.codex_session_id || existing.codex_session_id,
              diagnostics: { degrade_reason: null },
            }),
            { status: 200 }
          );
        }
      }

      const harness = await checkHarness();
      sessionCounter++;
      const sessionId = `sess_${sessionCounter}`;
      const transport = preferredTransport || harness.transport;

      const codexSid = body.codex_session_id as string | undefined;
      sessions.set(sessionId, {
        session_id: sessionId,
        lane_id: laneId,
        transport,
        ...(codexSid !== undefined && { codex_session_id: codexSid }),
      });
      lane.session_id = sessionId;

      publishHttpEvent("session.created", { session_id: sessionId, lane_id: laneId, transport });

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          transport,
          status: "attached",
          codex_session_id: body.codex_session_id,
          diagnostics: { degrade_reason: harness.degrade_reason },
        }),
        { status: 200 }
      );
    }

    // Route: POST /v1/workspaces/:ws/lanes/:lane/terminals
    const terminalsMatch = path.match(/^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/terminals$/);
    if (terminalsMatch && method === "POST") {
      const workspaceId = terminalsMatch[1];
      const laneId = terminalsMatch[2];
      const body = (await req.json()) as Record<string, unknown>;
      const sessionId = body.session_id as string;

      const lane = lanes.get(laneId);
      if (!lane) {
        return new Response(JSON.stringify({ error: "lane_not_found" }), { status: 404 });
      }

      if (lane.state === "closed") {
        return new Response(JSON.stringify({ error: "lane_closed" }), { status: 409 });
      }

      if (lane.workspace_id !== workspaceId) {
        return new Response(
          JSON.stringify({ error: `Lane ${laneId} does not belong to workspace ${workspaceId}` }),
          { status: 409 }
        );
      }

      termCounter++;
      const termId = `term_${termCounter}`;

      // Emit lifecycle events via bus
      const correlationId = `corr-term-${termCounter}`;
      await bus.request({
        id: `cmd-term-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.spawn",
        correlation_id: correlationId,
        workspace_id: workspaceId,
        lane_id: laneId,
        session_id: sessionId,
        payload: { session_id: sessionId, terminal_id: termId },
      } as any);

      terminals.set(termId, {
        terminal_id: termId,
        workspace_id: workspaceId,
        lane_id: laneId,
        session_id: sessionId,
        state: "active",
      });
      terminalState = "active";

      return new Response(
        JSON.stringify({
          terminal_id: termId,
          lane_id: laneId,
          session_id: sessionId,
          state: "active",
        }),
        { status: 201 }
      );
    }

    // Route: POST /v1/workspaces/:ws/lanes/:lane/cleanup
    const cleanupMatch = path.match(/^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/cleanup$/);
    if (cleanupMatch && method === "POST") {
      const laneId = cleanupMatch[2];
      const lane = lanes.get(laneId);
      if (lane) {
        lane.state = "closed";
      }
      return new Response(JSON.stringify({ status: "cleaned" }), { status: 200 });
    }

    // Route: GET /v1/harness/cliproxy/status
    if (path === "/v1/harness/cliproxy/status") {
      return new Response(JSON.stringify(harnessStatus), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }

  function getTerminal(terminalId: string): TerminalRecord | undefined {
    return terminals.get(terminalId);
  }

  return {
    bus,
    getState: () => {
      const state = bus.getState();
      const result: any = { ...state };
      if (terminalState) {
        result.terminal = terminalState;
      }
      // Track session state from HTTP sessions
      if (sessions.size > 0) {
        result.session = "attached";
      }
      return result;
    },
    getEvents: () => bus.getEvents(),
    getAuditRecords: () => bus.getAuditRecords(),
    getTerminalBuffer,
    getTerminal,
    spawnTerminal,
    inputTerminal,
    resizeTerminal,
    fetch: handleFetch,
=======
>>>>>>> origin/main
  };
}

export function createRuntime(options: RuntimeOptions = {}) {
  const bus = new InMemoryLocalBus();
  const recovery = new RecoveryRegistry();
  const redactionEngine = new RedactionEngine();
  redactionEngine.loadRules(getDefaultRules());

  const auditRecords: RuntimeAuditRecord[] = [];
  let bootstrapResult: RecoveryBootstrapResult | null = null;

  if (options.recovery_metadata) {
    bootstrapResult = recovery.bootstrap(options.recovery_metadata);
  }

  function appendAuditRecord(record: RuntimeAuditRecord): void {
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
    async getAuditRecords(): Promise<RuntimeAuditRecord[]> {
      return [...auditRecords];
    },
    shutdown(): void {},
  };
}

export type { RuntimeInstance };
