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
import type { AuditRecord, BusState, LocalBusEnvelope } from "./protocol/bus";

interface TerminalRecord {
  terminalId: string;
  workspaceId: string;
  laneId: string;
  sessionId: string;
  state: "active" | "throttled" | "inactive";
}

interface BufferEntry {
  seq: number;
  data: string;
  bytes: number;
}

interface TerminalBufferState {
  entries: BufferEntry[];
  totalBytes: number;
  droppedBytes: number;
  capBytes: number;
  nextSeq: number;
}

type TerminalBuffer = Record<string, unknown>;

type TerminalState = "active" | "throttled" | "inactive";
type RuntimeState = BusState & { terminal?: TerminalState };
type RuntimeCommand = Record<string, unknown>;
type RouteHandler = (match: RegExpMatchArray, req: Request) => Response | Promise<Response>;

interface RuntimeOptions {
  terminalBufferCapBytes?: number;
  harnessProbe?: {
    check(): Promise<{ ok: boolean; reason?: string }>;
  };
}

interface TerminalInputCommand {
  correlationId?: string | undefined;
  workspaceId?: string | undefined;
  laneId?: string | undefined;
  sessionId?: string | undefined;
  terminalId?: string | undefined;
  data?: string | undefined;
}

interface TerminalResizeCommand {
  correlationId?: string | undefined;
  workspaceId?: string | undefined;
  laneId?: string | undefined;
  sessionId?: string | undefined;
  terminalId?: string | undefined;
  cols?: number | undefined;
  rows?: number | undefined;
}

interface SpawnCommand {
  commandId?: string | undefined;
  correlationId?: string | undefined;
  workspaceId?: string | undefined;
  laneId?: string | undefined;
  sessionId?: string | undefined;
  title?: string | undefined;
}

interface LaneRecord {
  laneId: string;
  workspaceId: string;
  state: "open" | "closed";
  sessionId?: string;
}

interface SessionRecord {
  sessionId: string;
  laneId: string;
  transport: string;
  codexSessionId?: string;
}

interface HarnessStatus {
  status: string;
  degradeReason: string | null;
}

interface CommandContext {
  correlationId?: string | undefined;
  workspaceId?: string | undefined;
  laneId?: string | undefined;
  sessionId?: string | undefined;
  terminalId?: string | undefined;
}

interface ProtocolEnvelope {
  id: string;
  type: "command" | "response" | "event";
  ts: string;
  status?: "ok" | "error" | undefined;
  correlationId?: string | undefined;
  workspaceId?: string | undefined;
  sessionId?: string | undefined;
  terminalId?: string | undefined;
  laneId?: string | undefined;
  method?: string | undefined;
  topic?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  result?: Record<string, unknown> | null | undefined;
  error?:
    | {
        code: string;
        message: string;
        retryable?: boolean | undefined;
        details?: Record<string, unknown> | null;
      }
    | null
    | undefined;
  sequence?: number | undefined;
  envelopeId?: string | undefined;
  timestamp?: string | undefined;
}

type ProtocolEnvelopeInput = {
  id: string;
  type: "command" | "response" | "event";
  ts: string;
} & {
  [K in Exclude<keyof ProtocolEnvelope, "id" | "type" | "ts">]?: ProtocolEnvelope[K] | undefined;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getRuntimeString(params: RuntimeCommand, key: string): string | undefined {
  return asString((params as Record<string, unknown>)[key]);
}

function getRuntimeNumber(params: RuntimeCommand, key: string): number | undefined {
  return asNumber((params as Record<string, unknown>)[key]);
}

function parseSpawnCommand(params: RuntimeCommand): SpawnCommand {
  return {
    commandId: getRuntimeString(params, "command_id"),
    correlationId: getRuntimeString(params, "correlation_id"),
    workspaceId: getRuntimeString(params, "workspace_id"),
    laneId: getRuntimeString(params, "lane_id"),
    sessionId: getRuntimeString(params, "session_id"),
    title: getRuntimeString(params, "title"),
  };
}

function parseInputCommand(params: RuntimeCommand): TerminalInputCommand {
  return {
    correlationId: getRuntimeString(params, "correlation_id"),
    workspaceId: getRuntimeString(params, "workspace_id"),
    laneId: getRuntimeString(params, "lane_id"),
    sessionId: getRuntimeString(params, "session_id"),
    terminalId: getRuntimeString(params, "terminal_id"),
    data: asString((params as Record<string, unknown>).data),
  };
}

function parseResizeCommand(params: RuntimeCommand): TerminalResizeCommand {
  return {
    correlationId: getRuntimeString(params, "correlation_id"),
    workspaceId: getRuntimeString(params, "workspace_id"),
    laneId: getRuntimeString(params, "lane_id"),
    sessionId: getRuntimeString(params, "session_id"),
    terminalId: getRuntimeString(params, "terminal_id"),
    cols: getRuntimeNumber(params, "cols"),
    rows: getRuntimeNumber(params, "rows"),
  };
}

function toProtocolValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => toProtocolValue(entry));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return toProtocolRecord(value as Record<string, unknown>);
}

function toProtocolName(value: string): string {
  return value.replace(/[A-Z]/g, "_$&").toLowerCase();
}

function toProtocolRecord<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const protocol: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue === undefined) {
      continue;
    }
    protocol[toProtocolName(key)] = toProtocolValue(rawValue);
  }
  return protocol;
}

function asResponseError(
  code: string,
  message: string
): {
  code: string;
  message: string;
  retryable: boolean;
} {
  return {
    code,
    message,
    retryable: false,
  };
}

function createProtocolEnvelope(value: ProtocolEnvelopeInput): LocalBusEnvelope {
  return toProtocolRecord(value as unknown as Record<string, unknown>) as LocalBusEnvelope;
}

function createResponseEnvelope(
  status: "ok" | "error",
  correlationId?: string,
  result?: LocalBusEnvelope["result"],
  error?: LocalBusEnvelope["error"]
): LocalBusEnvelope {
  const normalizedError = error === null || error === undefined ? undefined : error;
  return createProtocolEnvelope({
    id: `res-${Date.now()}`,
    type: "response",
    ts: new Date().toISOString(),
    status,
    correlationId,
    result,
    ...(normalizedError ? { error: normalizedError } : {}),
  });
}

function createTerminalBuffer(capBytes: number): TerminalBufferState {
  return {
    entries: [],
    totalBytes: 0,
    droppedBytes: 0,
    capBytes,
    nextSeq: 1,
  };
}

function getTerminalResultId(result: LocalBusEnvelope["result"]): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const terminalId = asString((result as Record<string, unknown>)?.terminal_id);
  return typeof terminalId === "string" ? terminalId : undefined;
}

export function createRuntime(opts: RuntimeOptions = {}): {
  bus: InMemoryLocalBus;
  getState: () => RuntimeState;
  getEvents: () => LocalBusEnvelope[];
  getAuditRecords: () => Promise<AuditRecord[]>;
  getTerminalBuffer: (terminalId: string) => TerminalBuffer;
  getTerminal: (terminalId: string) => TerminalRecord | undefined;
  spawnTerminal: (params: RuntimeCommand) => Promise<LocalBusEnvelope>;
  inputTerminal: (params: RuntimeCommand) => Promise<LocalBusEnvelope>;
  resizeTerminal: (params: RuntimeCommand) => Promise<LocalBusEnvelope>;
  fetch: (req: Request) => Promise<Response>;
} {
  const bus = new InMemoryLocalBus();
  const terminals = new Map<string, TerminalRecord>();
  const buffers = new Map<string, TerminalBufferState>();
  const lanes = new Map<string, LaneRecord>();
  const sessions = new Map<string, SessionRecord>();
  const bufferCapBytes = (
    typeof opts?.terminalBufferCapBytes === "number" ? opts.terminalBufferCapBytes : 65536
  ) as number;
  const harnessProbe = opts?.harnessProbe;
  let terminalState: "active" | "throttled" | "inactive" | undefined;
  let harnessStatus: HarnessStatus = {
    status: "available",
    degradeReason: null,
  };
  let laneCounter = 0;
  let sessionCounter = 0;
  let termCounter = 0;

  function makeTerminalId(sessionId: string): string {
    return `terminal_${sessionId}_${Date.now()}`;
  }

  function registerTerminalFromCommand(
    terminalId: string,
    command: SpawnCommand,
    state: TerminalState = "active"
  ): void {
    terminals.set(terminalId, {
      terminalId,
      workspaceId: command.workspaceId || "",
      laneId: command.laneId || "",
      sessionId: command.sessionId || "",
      state,
    });
    buffers.set(terminalId, createTerminalBuffer(bufferCapBytes));
    terminalState = state;
  }

  function createErrorResponseEnvelope(
    code: string,
    message: string,
    correlationId?: string
  ): LocalBusEnvelope {
    return createResponseEnvelope(
      "error",
      correlationId,
      undefined,
      asResponseError(code, message)
    );
  }

  function emitEvent(
    topic: string,
    payload: Record<string, unknown>,
    context: CommandContext = {}
  ): Promise<void> {
    const eventEnvelope = createProtocolEnvelope({
      id: `evt-${topic}-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload,
      ...context,
    });
    return bus.publish(eventEnvelope);
  }

  function appendTerminalBuffer(
    terminalId: string,
    data: string
  ): { outputSeq: number; overflowed: boolean } {
    const buffer = buffers.get(terminalId);
    if (!buffer) {
      return { outputSeq: -1, overflowed: false };
    }

    const byteLength = new TextEncoder().encode(data).length;
    if (buffer.totalBytes + byteLength <= buffer.capBytes) {
      const seq = buffer.nextSeq++;
      buffer.entries.push({ seq, data, bytes: byteLength });
      buffer.totalBytes += byteLength;
      return {
        outputSeq: seq,
        overflowed: false,
      };
    }

    const dropped = byteLength - (buffer.capBytes - buffer.totalBytes);
    buffer.droppedBytes += dropped;

    while (buffer.totalBytes + byteLength > buffer.capBytes && buffer.entries.length > 0) {
      const droppedEntry = buffer.entries.shift();
      if (!droppedEntry) {
        break;
      }
      buffer.totalBytes -= droppedEntry.bytes;
    }

    if (buffer.totalBytes + byteLength > buffer.capBytes) {
      buffer.droppedBytes += byteLength;
      return {
        outputSeq: buffer.nextSeq,
        overflowed: true,
      };
    }

    const seq = buffer.nextSeq++;
    buffer.entries.push({ seq, data, bytes: byteLength });
    buffer.totalBytes += byteLength;
    return {
      outputSeq: seq,
      overflowed: true,
    };
  }

  async function checkHarness(): Promise<{ transport: string; degradeReason: string | null }> {
    if (!harnessProbe) {
      return { transport: "cliproxy_harness", degradeReason: null };
    }

    const result = await harnessProbe.check();
    if (result.ok) {
      harnessStatus = { status: "available", degradeReason: null };
      return { transport: "cliproxy_harness", degradeReason: null };
    }

    const previousStatus = harnessStatus.status;
    harnessStatus = {
      status: "unavailable",
      degradeReason: result.reason || "unknown",
    };

    if (previousStatus !== "unavailable") {
      await publishHttpEvent("harness.status.changed", {
        status: "unavailable",
        reason: result.reason,
      });
    }
    return { transport: "native_openai", degradeReason: result.reason || "unknown" };
  }

  function publishHttpEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    return Promise.resolve(
      bus.pushEvent(
        toProtocolRecord({
          id: `evt-http-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "event",
          ts: new Date().toISOString(),
          topic,
          payload,
          correlationId: "runtime-fetch",
        }) as LocalBusEnvelope
      )
    );
  }

  function toProtocolBufferState(payload: TerminalBufferState): TerminalBuffer {
    return toProtocolRecord({
      capBytes: payload.capBytes,
      droppedBytes: payload.droppedBytes,
      totalBytes: payload.totalBytes,
      nextSeq: payload.nextSeq,
      entries: payload.entries,
    }) as TerminalBuffer;
  }

  function buildTerminalBufferMissing(): TerminalBuffer {
    return toProtocolRecord({
      entries: [],
      totalBytes: 0,
      droppedBytes: 0,
      capBytes: bufferCapBytes,
      nextSeq: 1,
    }) as TerminalBuffer;
  }

  async function handleCreateLane(match: RegExpMatchArray): Promise<Response> {
    const workspaceId = match[1];
    laneCounter += 1;
    const laneId = `lane_${laneCounter}`;
    lanes.set(laneId, { laneId, workspaceId, state: "open" });

    await publishHttpEvent("lane.created", {
      laneId,
      status: "created",
    });

    return new Response(
      JSON.stringify(
        toProtocolRecord({
          laneId,
          status: "created",
        })
      ),
      { status: 201 }
    );
  }

  async function handleCreateSession(match: RegExpMatchArray, req: Request): Promise<Response> {
    const laneId = match[2];
    const lane = lanes.get(laneId);
    if (!lane) {
      return new Response(JSON.stringify(toProtocolRecord({ error: "lane_not_found" })), {
        status: 404,
      });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const preferredTransport = asString(body.preferred_transport);
    const validTransports = ["cliproxy_harness", "native_openai", undefined];

    if (preferredTransport && !validTransports.includes(preferredTransport)) {
      return new Response(
        JSON.stringify(toProtocolRecord({ error: "invalid_preferred_transport" })),
        { status: 400 }
      );
    }

    if (lane.sessionId) {
      const existing = sessions.get(lane.sessionId);
      if (existing) {
        return new Response(
          JSON.stringify(
            toProtocolRecord({
              sessionId: existing.sessionId,
              transport: existing.transport,
              status: "attached",
              codexSessionId:
                (asString(body.codex_session_id) as string | undefined) || existing.codexSessionId,
              diagnostics: { degradeReason: null },
            })
          ),
          { status: 200 }
        );
      }
    }

    const { transport, degradeReason } = await checkHarness();
    sessionCounter += 1;
    const sessionId = `sess_${sessionCounter}`;
    const codexSessionId = asString(body.codex_session_id);
    const sessionRecord: SessionRecord = {
      sessionId,
      laneId,
      transport,
      ...(codexSessionId !== undefined ? { codexSessionId } : {}),
    };
    sessions.set(sessionId, sessionRecord);
    lane.sessionId = sessionId;

    await publishHttpEvent("session.created", { sessionId, laneId, transport });

    return new Response(
      JSON.stringify(
        toProtocolRecord({
          sessionId,
          transport,
          status: "attached",
          codexSessionId,
          diagnostics: { degradeReason },
        })
      ),
      { status: 200 }
    );
  }

  async function handleCreateTerminal(match: RegExpMatchArray, req: Request): Promise<Response> {
    const workspaceId = match[1];
    const laneId = match[2];
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId = asString(body.session_id);

    const lane = lanes.get(laneId);
    if (!lane) {
      return new Response(JSON.stringify(toProtocolRecord({ error: "lane_not_found" })), {
        status: 404,
      });
    }

    if (lane.state === "closed") {
      return new Response(JSON.stringify(toProtocolRecord({ error: "lane_closed" })), {
        status: 409,
      });
    }

    if (lane.workspaceId !== workspaceId) {
      return new Response(
        JSON.stringify(
          toProtocolRecord({
            error: `Lane ${laneId} does not belong to workspace ${workspaceId}`,
          })
        ),
        { status: 409 }
      );
    }

    termCounter += 1;
    const terminalId = `term_${termCounter}`;
    const correlationId = `corr-term-${termCounter}`;
    const busResponse = await bus.request(
      createProtocolEnvelope({
        id: `cmd-term-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.spawn",
        correlationId,
        workspaceId,
        laneId,
        sessionId,
        payload: {
          sessionId,
          terminalId,
          title: asString(body.title),
        },
      })
    );

    if (busResponse.status !== "ok") {
      return new Response(JSON.stringify(busResponse), { status: 500 });
    }

    if (sessionId !== undefined) {
      terminals.set(terminalId, {
        terminalId,
        workspaceId,
        laneId,
        sessionId,
        state: "active",
      });
      buffers.set(terminalId, createTerminalBuffer(bufferCapBytes));
      terminalState = "active";
    }

    return new Response(
      JSON.stringify(
        toProtocolRecord({
          terminalId,
          laneId,
          sessionId,
          state: "active",
        })
      ),
      { status: 201 }
    );
  }

  function handleCleanup(match: RegExpMatchArray): Response {
    const laneId = match[2];
    const lane = lanes.get(laneId);
    if (lane) {
      lane.state = "closed";
    }
    return new Response(JSON.stringify(toProtocolRecord({ status: "cleaned" })), { status: 200 });
  }

  function handleStatus(): Response {
    return new Response(
      JSON.stringify(
        toProtocolRecord({
          status: harnessStatus.status,
          degradeReason: harnessStatus.degradeReason,
        })
      ),
      { status: 200 }
    );
  }

  async function spawnTerminal(params: RuntimeCommand): Promise<LocalBusEnvelope> {
    const command = parseSpawnCommand(params);
    const terminalId = makeTerminalId(command.sessionId || "unknown");

    // Register lifecycle progress
    const response = await bus.request({
      ...createProtocolEnvelope({
        id: command.commandId || `cmd-${Date.now()}`,
        type: "command",
        ts: new Date().toISOString(),
        method: "terminal.spawn",
        correlationId: command.correlationId,
        workspaceId: command.workspaceId,
        laneId: command.laneId,
        sessionId: command.sessionId,
        payload: {
          sessionId: command.sessionId,
          terminalId,
          title: command.title,
        },
      }),
    });

    if (response.status === "ok") {
      const tid = getTerminalResultId(response.result) || terminalId;
      registerTerminalFromCommand(tid, {
        ...command,
        sessionId: command.sessionId || "",
      });
    }

    return response;
  }

  function getInputValidationError(command: TerminalInputCommand): LocalBusEnvelope | undefined {
    const terminalId = command.terminalId || "";
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return createErrorResponseEnvelope(
        "TERMINAL_NOT_FOUND",
        "Terminal not found",
        command.correlationId
      );
    }

    if (terminal.laneId !== command.laneId) {
      return createErrorResponseEnvelope(
        "TERMINAL_CONTEXT_MISMATCH",
        "Terminal does not belong to this lane",
        command.correlationId
      );
    }

    if (command.data === undefined) {
      return createErrorResponseEnvelope(
        "INVALID_TERMINAL_INPUT",
        "payload.data is required",
        command.correlationId
      );
    }

    return undefined;
  }

  function toRuntimeStatePayload(): { session: "attached" | "detached"; terminal: TerminalState } {
    return {
      session: sessions.size > 0 ? "attached" : "detached",
      terminal: terminalState || "inactive",
    };
  }

  async function inputTerminal(params: RuntimeCommand): Promise<LocalBusEnvelope> {
    const command = parseInputCommand(params);
    const validationError = getInputValidationError(command);
    if (validationError) {
      return validationError;
    }

    const terminalId = command.terminalId || "";
    const data = command.data;
    if (data === undefined) {
      return createErrorResponseEnvelope(
        "INVALID_TERMINAL_INPUT",
        "payload.data is required",
        command.correlationId
      );
    }

    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return createErrorResponseEnvelope(
        "TERMINAL_NOT_FOUND",
        "Terminal not found",
        command.correlationId
      );
    }

    const { outputSeq, overflowed } = appendTerminalBuffer(terminalId, data);
    if (outputSeq < 0) {
      return createErrorResponseEnvelope(
        "TERMINAL_BUFFER_MISSING",
        "No buffer for terminal",
        command.correlationId
      );
    }

    await emitEvent(
      "terminal.output",
      {
        data,
        overflowed,
        outputSeq,
      },
      command
    );

    if (overflowed) {
      terminal.state = "throttled";
      terminalState = "throttled";
      await emitEvent("terminal.state.changed", { state: "throttled" }, command);
    }

    return createResponseEnvelope("ok", command.correlationId, {
      outputSeq,
    });
  }

  async function resizeTerminal(params: RuntimeCommand): Promise<LocalBusEnvelope> {
    const command = parseResizeCommand(params);
    const terminalId = command.terminalId || "";
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return createErrorResponseEnvelope(
        "TERMINAL_NOT_FOUND",
        "Terminal not found",
        command.correlationId
      );
    }

    if (terminal.state === "throttled") {
      terminal.state = "active";
      terminalState = "active";
      await emitEvent(
        "terminal.state.changed",
        { state: "active", runtimeState: toRuntimeStatePayload() },
        command
      );
    }

    return createResponseEnvelope("ok", command.correlationId, {
      cols: command.cols,
      rows: command.rows,
    });
  }

  function getTerminalBuffer(terminalId: string): TerminalBuffer {
    const buffer = buffers.get(terminalId);
    if (!buffer) {
      return buildTerminalBufferMissing();
    }
    return toProtocolBufferState(buffer);
  }

  function resolveSpawnTerminalFromCommand(
    command: LocalBusEnvelope,
    response: LocalBusEnvelope
  ): string | undefined {
    if (
      command.method !== "terminal.spawn" ||
      response.type !== "response" ||
      response.status !== "ok"
    ) {
      return undefined;
    }

    const terminalResultId = getTerminalResultId(response.result);
    if (terminalResultId) {
      return terminalResultId;
    }

    const payload = command.payload as Record<string, unknown> | undefined;
    return asString(payload?.terminal_id);
  }

  function findTerminalForInputCommand(command: LocalBusEnvelope): TerminalRecord | undefined {
    return terminals.get(asString((command as Record<string, unknown>).terminal_id) || "");
  }

  function buildTerminalCommandFromBus(command: LocalBusEnvelope): SpawnCommand {
    const payload = command.payload as Record<string, unknown> | undefined;
    return {
      commandId: command.id,
      correlationId: command.correlation_id,
      workspaceId: asString(payload?.workspace_id) || command.workspace_id,
      laneId: asString(payload?.lane_id) || command.lane_id,
      sessionId: asString(payload?.session_id) || command.session_id,
      title: asString(payload?.title),
    };
  }

  function matchCrossLaneTerminalInput(command: LocalBusEnvelope): LocalBusEnvelope | undefined {
    if (command.method !== "terminal.input") {
      return undefined;
    }

    const terminal = findTerminalForInputCommand(command);
    if (terminal && command.lane_id && terminal.laneId !== command.lane_id) {
      return createErrorResponseEnvelope(
        "TERMINAL_CONTEXT_MISMATCH",
        "Terminal does not belong to this lane",
        command.correlation_id
      );
    }

    return undefined;
  }

  // Wrap bus.request to intercept terminal.spawn and track terminals
  const originalRequest = bus.request.bind(bus);
  bus.request = async (command: LocalBusEnvelope): Promise<LocalBusEnvelope> => {
    const response = await originalRequest(command);

    const terminalId = resolveSpawnTerminalFromCommand(command, response);
    if (terminalId) {
      registerTerminalFromCommand(terminalId, buildTerminalCommandFromBus(command));
      return response;
    }

    return matchCrossLaneTerminalInput(command) ?? response;
  };

  function createNotFoundResponse(): Response {
    return new Response(JSON.stringify(toProtocolRecord({ error: "not found" })), { status: 404 });
  }

  const fetchRoutes: Array<{
    method: "GET" | "POST";
    pattern: RegExp;
    handler: RouteHandler;
  }> = [
    { method: "POST", pattern: /^\/v1\/workspaces\/([^/]+)\/lanes$/, handler: handleCreateLane },
    {
      method: "POST",
      pattern: /^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/sessions$/,
      handler: handleCreateSession,
    },
    {
      method: "POST",
      pattern: /^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/terminals$/,
      handler: handleCreateTerminal,
    },
    {
      method: "POST",
      pattern: /^\/v1\/workspaces\/([^/]+)\/lanes\/([^/]+)\/cleanup$/,
      handler: handleCleanup,
    },
  ];

  function resolveFetchRoute(
    method: string,
    path: string
  ): { handler: RouteHandler; match: RegExpMatchArray } | undefined {
    for (const route of fetchRoutes) {
      const match = path.match(route.pattern);
      if (route.method === method && match) {
        return { handler: route.handler, match };
      }
    }
    return undefined;
  }

  async function handleFetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    const match = resolveFetchRoute(method, path);
    if (match) {
      return await match.handler(match.match, req);
    }

    if (path === "/v1/harness/cliproxy/status" && method === "GET") {
      return handleStatus();
    }

    return createNotFoundResponse();
  }

  function getTerminal(terminalId: string): TerminalRecord | undefined {
    return terminals.get(terminalId);
  }

  return {
    bus,
    getState: () => {
      const state = bus.getState();
      const result: RuntimeState = { ...state };
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
