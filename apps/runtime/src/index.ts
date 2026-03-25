/**
 * @helios/runtime — Core runtime package for heliosApp.
 */

import { InMemoryLocalBus } from "./protocol/bus.js";
import { createBoundaryDispatcher } from "./protocol/boundary_adapter.js";
import type { LocalBusEnvelope } from "./protocol/types.js";

export { InMemoryAuditSink } from "./audit/sink.js";
export { InMemoryLocalBus } from "./protocol/bus.js";
export type { LocalBus } from "./protocol/bus.js";

export const VERSION = "0.1.1" as const;

export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

const _startTime = performance.now();

export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - _startTime,
  };
}

// NOTE: Redaction and METHODS-related code removed - not yet implemented

type TerminalEntry = {
  id: string;
  workspace_id: string;
  lane_id: string;
  session_id: string;
  state: "active" | "inactive" | "throttled";
};

type BufferEntry = {
  seq: number;
  data: string;
};

type TerminalBuffer = {
  entries: BufferEntry[];
  total_bytes: number;
  dropped_bytes: number;
  next_seq: number;
};

type RecoveryMetadata = {
  lanes: Array<{ lane_id: string; workspace_id: string; session_id?: string }>;
  sessions: Array<{
    session_id: string;
    workspace_id: string;
    lane_id?: string;
    status: string;
    codex_session_id?: string;
  }>;
  terminals: Array<{
    terminal_id: string;
    workspace_id: string;
    session_id?: string;
    lane_id?: string;
    status: string;
  }>;
};

type BootstrapResult = {
  recovered_session_ids: string[];
  issues: Array<{
    id: string;
    state: "recoverable" | "unrecoverable";
    remediation: "cleanup" | "reconcile";
  }>;
};

type AuditBundle = {
  count: number;
  records: Array<{
    type?: string;
    topic?: string;
    payload?: Record<string, unknown>;
    recorded_at?: string;
  }>;
};

type RuntimeAuditRecord = Awaited<ReturnType<InMemoryLocalBus["getAuditRecords"]>>[number] & {
  recorded_at: string;
};

export type RuntimeHandle = {
  bus: InMemoryLocalBus;
  fetch(request: Request): Promise<Response>;
  getEvents(): ReturnType<InMemoryLocalBus["getEvents"]>;
  getAuditRecords(): Promise<RuntimeAuditRecord[]>;
  getTerminal(terminalId: string): TerminalEntry | null;
  getTerminalBuffer(terminalId: string): { entries: BufferEntry[]; total_bytes: number; dropped_bytes: number };
  getState(): ReturnType<InMemoryLocalBus["getState"]>;
  spawnTerminal(input: {
    command_id: string;
    correlation_id: string;
    workspace_id: string;
    lane_id: string;
    session_id: string;
    title?: string;
  }): Promise<LocalBusEnvelope>;
  inputTerminal(input: {
    command_id: string;
    correlation_id: string;
    workspace_id: string;
    lane_id: string;
    session_id: string;
    terminal_id: string;
    data: string;
  }): Promise<LocalBusEnvelope>;
  resizeTerminal(input: {
    command_id: string;
    correlation_id: string;
    workspace_id: string;
    lane_id: string;
    session_id: string;
    terminal_id: string;
    cols: number;
    rows: number;
  }): Promise<LocalBusEnvelope>;
  exportRecoveryMetadata(): RecoveryMetadata;
  getBootstrapResult(): BootstrapResult | null;
  bootstrapRecovery(metadata: RecoveryMetadata): void;
  getOrphanReport(): {
    issues: Array<{
      id: string;
      state: "recoverable" | "unrecoverable";
      remediation: "cleanup" | "reconcile";
    }>;
  };
  exportAuditBundle(filter: { correlation_id: string }): AuditBundle;
  shutdown(): void;
};

function makeIsoNow(): string {
  return new Date().toISOString();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sanitizePayload(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) =>
      key.toLowerCase().includes("api_key") ? [key, "[REDACTED]"] : [key, item]
    )
  );
}

function classifyBootstrap(metadata: RecoveryMetadata): BootstrapResult {
  const recovered_session_ids = metadata.sessions
    .filter((session) => session.status !== "detached")
    .map((session) => session.session_id);

  const issues: BootstrapResult["issues"] = [];
  for (const session of metadata.sessions) {
    if (session.status === "detached") {
      issues.push({
        id: session.session_id,
        state: "unrecoverable",
        remediation: "cleanup",
      });
    }
  }
  for (const lane of metadata.lanes) {
    if (lane.session_id && !metadata.sessions.some((session) => session.session_id === lane.session_id)) {
      issues.push({
        id: lane.lane_id,
        state: "recoverable",
        remediation: "reconcile",
      });
    }
  }
  for (const terminal of metadata.terminals) {
    if (terminal.session_id && !metadata.sessions.some((session) => session.session_id === terminal.session_id)) {
      issues.push({
        id: terminal.terminal_id,
        state: "unrecoverable",
        remediation: "cleanup",
      });
    }
  }

  return { recovered_session_ids, issues };
}

export type RuntimeOptions = {
  terminalBufferCapBytes?: number;
  harnessProbe?: {
    check(): Promise<{ ok: boolean; reason?: string }>;
  };
  recovery_metadata?: RecoveryMetadata;
};

export function createRuntime(options: RuntimeOptions = {}): RuntimeHandle {
  const bus = new InMemoryLocalBus();
  const dispatcher = createBoundaryDispatcher({
    dispatchLocal: async (command) => bus.request(command),
  });
  const terminals = new Map<string, TerminalEntry>();
  const terminalBuffers = new Map<string, TerminalBuffer>();
  const laneWorkspace = new Map<string, string>();
  const closedLanes = new Set<string>();
  let bootstrapResult = options.recovery_metadata ? classifyBootstrap(options.recovery_metadata) : null;

  function ensureBuffer(terminalId: string): TerminalBuffer {
    const existing = terminalBuffers.get(terminalId);
    if (existing) return existing;
    const created: TerminalBuffer = { entries: [], total_bytes: 0, dropped_bytes: 0, next_seq: 1 };
    terminalBuffers.set(terminalId, created);
    return created;
  }

  async function appendOutputEvent(
    correlation_id: string,
    terminal: TerminalEntry,
    buffer: TerminalBuffer,
    data: string
  ): Promise<void> {
    const cap = options.terminalBufferCapBytes ?? Number.MAX_SAFE_INTEGER;
    const bytes = data.length;
    const entry: BufferEntry = { seq: buffer.next_seq, data };
    buffer.next_seq += 1;
    buffer.entries.push(entry);
    buffer.total_bytes += bytes;

    let overflowed = false;
    while (buffer.total_bytes > cap && buffer.entries.length > 0) {
      const dropped = buffer.entries.shift();
      if (!dropped) break;
      buffer.total_bytes -= dropped.data.length;
      buffer.dropped_bytes += dropped.data.length;
      overflowed = true;
    }

    if (overflowed) {
      terminal.state = "throttled";
    }

    await bus.publish({
      id: `evt-output-${Date.now()}`,
      type: "event",
      ts: makeIsoNow(),
      topic: "terminal.output",
      workspace_id: terminal.workspace_id,
      lane_id: terminal.lane_id,
      session_id: terminal.session_id,
      terminal_id: terminal.id,
      correlation_id,
      payload: {
        output_seq: entry.seq,
        overflowed,
        backlog_depth: buffer.total_bytes,
        data,
      },
    });

    if (overflowed) {
      await bus.publish({
        id: `evt-state-${Date.now()}`,
        type: "event",
        ts: makeIsoNow(),
        topic: "terminal.state.changed",
        workspace_id: terminal.workspace_id,
        lane_id: terminal.lane_id,
        session_id: terminal.session_id,
        terminal_id: terminal.id,
        correlation_id,
        payload: {
          state: "throttled",
          runtime_state: bus.getState(),
        },
      });
    }
  }

  async function spawnTerminal(input: RuntimeHandle["spawnTerminal"] extends (arg: infer T) => Promise<unknown> ? T : never): Promise<LocalBusEnvelope> {
    if (closedLanes.has(input.lane_id)) {
      return {
        id: input.command_id,
        type: "response",
        ts: makeIsoNow(),
        correlation_id: input.correlation_id,
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        method: "terminal.spawn",
        status: "error",
        error: { code: "LANE_CLOSED", message: "lane_closed", retryable: false },
      };
    }
    const response = await bus.request({
      id: input.command_id,
      type: "command",
      ts: makeIsoNow(),
      method: "terminal.spawn",
      correlation_id: input.correlation_id,
      workspace_id: input.workspace_id,
      lane_id: input.lane_id,
      session_id: input.session_id,
      payload: {
        id: `${input.session_id}:terminal`,
        terminal_id: `${input.session_id}:terminal`,
        session_id: input.session_id,
        lane_id: input.lane_id,
        title: input.title,
      },
    });
    if (response.status === "ok") {
      const terminal_id = String(response.result?.terminal_id ?? `${input.session_id}:terminal`);
      terminals.set(terminal_id, {
        id: terminal_id,
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        state: "active",
      });
      terminalBuffers.set(terminal_id, { entries: [], total_bytes: 0, dropped_bytes: 0, next_seq: 1 });
    }
    return response;
  }

  async function inputTerminal(input: RuntimeHandle["inputTerminal"] extends (arg: infer T) => Promise<unknown> ? T : never): Promise<LocalBusEnvelope> {
    const terminal = terminals.get(input.terminal_id);
    if (!terminal || terminal.lane_id !== input.lane_id || terminal.session_id !== input.session_id) {
      return {
        id: input.command_id,
        type: "response",
        ts: makeIsoNow(),
        correlation_id: input.correlation_id,
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        terminal_id: input.terminal_id,
        method: "terminal.input",
        status: "error",
        error: { code: "TERMINAL_CONTEXT_MISMATCH", message: "terminal context mismatch", retryable: false },
      };
    }
    const response = await bus.request({
      id: input.command_id,
      type: "command",
      ts: makeIsoNow(),
      method: "terminal.input",
      correlation_id: input.correlation_id,
      workspace_id: input.workspace_id,
      lane_id: input.lane_id,
      session_id: input.session_id,
      terminal_id: input.terminal_id,
      payload: {
        terminal_id: input.terminal_id,
        session_id: input.session_id,
        data: input.data,
      },
    });
    if (response.status === "ok") {
      const buffer = ensureBuffer(input.terminal_id);
      await appendOutputEvent(input.correlation_id, terminal, buffer, input.data);
      response.correlation_id = input.correlation_id;
      response.result = {
        ...(response.result ?? {}),
        output_seq: buffer.next_seq - 1,
      };
    }
    return response;
  }

  async function resizeTerminal(input: RuntimeHandle["resizeTerminal"] extends (arg: infer T) => Promise<unknown> ? T : never): Promise<LocalBusEnvelope> {
    const terminal = terminals.get(input.terminal_id);
    if (!terminal) {
      return {
        id: input.command_id,
        type: "response",
        ts: makeIsoNow(),
        correlation_id: input.correlation_id,
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        terminal_id: input.terminal_id,
        method: "terminal.resize",
        status: "error",
        error: { code: "TERMINAL_NOT_FOUND", message: "terminal not found", retryable: false },
      };
    }
    terminal.state = "active";
    await bus.publish({
      id: `evt-resize-${Date.now()}`,
      type: "event",
      ts: makeIsoNow(),
      topic: "terminal.state.changed",
      workspace_id: terminal.workspace_id,
      lane_id: terminal.lane_id,
      session_id: terminal.session_id,
      terminal_id: terminal.id,
      correlation_id: input.correlation_id,
      payload: {
        state: "active",
        runtime_state: bus.getState(),
        cols: input.cols,
        rows: input.rows,
      },
    });
    return {
      id: input.command_id,
      type: "response",
      ts: makeIsoNow(),
      correlation_id: input.correlation_id,
      workspace_id: input.workspace_id,
      lane_id: input.lane_id,
      session_id: input.session_id,
      terminal_id: input.terminal_id,
      method: "terminal.resize",
      status: "ok",
      result: {},
    };
  }

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === "POST" ? ((await request.json()) as Record<string, unknown>) : {};

    if (request.method === "POST" && url.pathname === "/v1/protocol/dispatch") {
      const response = await dispatcher({
        id: `cmd-${Date.now()}`,
        type: "command",
        ts: makeIsoNow(),
        correlation_id:
          typeof body.correlation_id === "string" ? body.correlation_id : `corr-${Date.now()}`,
        workspace_id: typeof body.workspace_id === "string" ? body.workspace_id : undefined,
        lane_id: typeof body.lane_id === "string" ? body.lane_id : undefined,
        session_id: typeof body.session_id === "string" ? body.session_id : undefined,
        terminal_id: typeof body.terminal_id === "string" ? body.terminal_id : undefined,
        method: typeof body.method === "string" ? body.method : undefined,
        payload:
          body.payload && typeof body.payload === "object"
            ? (body.payload as Record<string, unknown>)
            : {},
      });
      return json(
        response.status === "error"
          ? { error: response.error?.code ?? "UNKNOWN_ERROR", details: response.error?.details ?? null }
          : response.result ?? {},
        response.status === "error"
          ? response.error?.code === "UNSUPPORTED_BOUNDARY_ADAPTER"
            ? 409
            : 400
          : 200
      );
    }

    if (request.method === "POST" && /^\/v1\/workspaces\/[^/]+\/lanes$/.test(url.pathname)) {
      const workspace_id = url.pathname.split("/")[3] ?? "ws_1";
      const lane_id = String(body.display_name ?? body.project_context_id ?? `lane_${Date.now()}`);
      laneWorkspace.set(lane_id, workspace_id);
      await bus.request({
        id: `cmd-lane-create-${Date.now()}`,
        type: "command",
        ts: makeIsoNow(),
        workspace_id,
        correlation_id: `corr-lane-${Date.now()}`,
        method: "lane.create",
        payload: { id: lane_id, lane_id },
      });
      return json({ lane_id }, 201);
    }

    if (request.method === "POST" && /\/v1\/workspaces\/[^/]+\/lanes\/[^/]+\/sessions$/.test(url.pathname)) {
      const [, , , workspace_id, , lane_id] = url.pathname.split("/");
      const preferred_transport = body.preferred_transport;
      if (preferred_transport !== undefined && preferred_transport !== "cliproxy_harness" && preferred_transport !== "native_openai") {
        return json({ error: "invalid_preferred_transport" }, 400);
      }
      const harness = (await options.harnessProbe?.check?.()) ?? { ok: true };
      const transport = harness.ok ? "cliproxy_harness" : "native_openai";
      const degrade_reason = harness.ok ? null : harness.reason ?? "cliproxy_unavailable";
      const session_id = String(body.codex_session_id ?? `${lane_id}:session`);
      await bus.request({
        id: `cmd-session-${Date.now()}`,
        type: "command",
        ts: makeIsoNow(),
        workspace_id,
        lane_id,
        session_id,
        correlation_id: `corr-session-${Date.now()}`,
        method: "session.attach",
        payload: {
          id: session_id,
          lane_id,
          session_id,
          ...(degrade_reason ? { boundary_failure: "harness" } : {}),
        },
      });
      if (!harness.ok) {
        await bus.publish({
          id: `evt-harness-${Date.now()}`,
          type: "event",
          ts: makeIsoNow(),
          topic: "harness.status.changed",
          correlation_id: `corr-harness-${Date.now()}`,
          workspace_id,
          lane_id,
          payload: { status: "unavailable", degrade_reason },
        });
      }
      return json({
        session_id,
        codex_session_id: body.codex_session_id ?? undefined,
        transport,
        status: "attached",
        diagnostics: { degrade_reason },
      });
    }

    if (request.method === "POST" && /\/v1\/workspaces\/[^/]+\/lanes\/[^/]+\/terminals$/.test(url.pathname)) {
      const [, , , workspace_id, , lane_id] = url.pathname.split("/");
      if (laneWorkspace.get(lane_id) && laneWorkspace.get(lane_id) !== workspace_id) {
        return json({ error: "lane does not belong to workspace" }, 409);
      }
      if (closedLanes.has(lane_id)) {
        return json({ error: "lane_closed" }, 409);
      }
      const session_id = String(body.session_id ?? `${lane_id}:session`);
      const response = await spawnTerminal({
        command_id: `cmd-term-${Date.now()}`,
        correlation_id: `corr-term-${Date.now()}`,
        workspace_id,
        lane_id,
        session_id,
        title: typeof body.title === "string" ? body.title : undefined,
      });
      return json(
        {
          terminal_id: response.result?.terminal_id,
          lane_id,
          session_id,
          state: "active",
        },
        response.status === "ok" ? 201 : 409
      );
    }

    if (request.method === "POST" && /\/v1\/workspaces\/[^/]+\/lanes\/[^/]+\/cleanup$/.test(url.pathname)) {
      const lane_id = url.pathname.split("/")[5] ?? "";
      closedLanes.add(lane_id);
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/v1/harness/cliproxy/status") {
      const harness = (await options.harnessProbe?.check?.()) ?? { ok: true };
      return json({
        status: harness.ok ? "healthy" : "unavailable",
        degrade_reason: harness.ok ? null : harness.reason ?? "cliproxy_unavailable",
      });
    }

    return json({ error: "not_implemented" }, 501);
  }

  function exportRecoveryMetadata(): RecoveryMetadata {
    return {
      lanes: [...laneWorkspace.entries()].map(([lane_id, workspace_id]) => ({ lane_id, workspace_id })),
      sessions: [...terminals.values()].map((terminal) => ({
        session_id: terminal.session_id,
        workspace_id: terminal.workspace_id,
        lane_id: terminal.lane_id,
        status: "attached",
      })),
      terminals: [...terminals.values()].map((terminal) => ({
        terminal_id: terminal.id,
        workspace_id: terminal.workspace_id,
        lane_id: terminal.lane_id,
        session_id: terminal.session_id,
        status: terminal.state,
      })),
    };
  }

  function bootstrapRecovery(metadata: RecoveryMetadata): void {
    bootstrapResult = classifyBootstrap(metadata);
  }

  function getOrphanReport() {
    return { issues: bootstrapResult?.issues ?? [] };
  }

  function exportAuditBundle(filter: { correlation_id: string }): AuditBundle {
    return {
      count: bus.getEvents().filter((event) => event.correlation_id === filter.correlation_id).length,
      records: bus
        .getEvents()
        .filter((event) => event.correlation_id === filter.correlation_id)
        .map((event) => ({
          recorded_at:
            typeof event.ts === "string"
              ? event.ts
              : typeof event.timestamp === "string"
                ? event.timestamp
                : new Date().toISOString(),
          type: event.type,
          topic: event.topic,
          payload: sanitizePayload((event.payload as Record<string, unknown> | undefined) ?? {}),
        })),
    };
  }

  return {
    bus,
    fetch,
    getEvents() {
      return bus.getEvents();
    },
    async getAuditRecords() {
      const records = await bus.getAuditRecords();
      return records.map((record) => ({
        ...record,
        recorded_at:
          typeof record.envelope.ts === "string"
            ? record.envelope.ts
            : typeof record.envelope.timestamp === "string"
              ? record.envelope.timestamp
              : new Date().toISOString(),
      }));
    },
    getTerminal(terminalId: string) {
      return terminals.get(terminalId) ?? null;
    },
    getTerminalBuffer(terminalId: string) {
      const buffer = ensureBuffer(terminalId);
      return {
        entries: [...buffer.entries],
        total_bytes: buffer.total_bytes,
        dropped_bytes: buffer.dropped_bytes,
      };
    },
    getState() {
      const state = bus.getState();
      if ([...terminals.values()].some((terminal) => terminal.state === "throttled")) {
        return { ...state, terminal: "throttled" as const };
      }
      if (terminals.size > 0) {
        return { ...state, terminal: "active" as const };
      }
      return state;
    },
    spawnTerminal,
    inputTerminal,
    resizeTerminal,
    exportRecoveryMetadata,
    getBootstrapResult() {
      return bootstrapResult;
    },
    bootstrapRecovery,
    getOrphanReport,
    exportAuditBundle,
    shutdown() {
      terminals.clear();
      terminalBuffers.clear();
      closedLanes.clear();
    },
  };
}
