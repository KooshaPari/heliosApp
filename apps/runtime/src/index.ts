/**
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

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

const startTime = performance.now();

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
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

      sessions.set(sessionId, {
        session_id: sessionId,
        lane_id: laneId,
        transport,
        codex_session_id: body.codex_session_id as string | undefined,
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
  };
}
