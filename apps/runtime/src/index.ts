/**
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

<<<<<<< HEAD
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
    commandId: getRuntimeString(params, "commandId"),
    correlationId: getRuntimeString(params, "correlationId"),
    workspaceId: getRuntimeString(params, "workspaceId"),
    laneId: getRuntimeString(params, "laneId"),
    sessionId: getRuntimeString(params, "sessionId"),
    title: getRuntimeString(params, "title"),
  };
}

function parseInputCommand(params: RuntimeCommand): TerminalInputCommand {
  return {
    correlationId: getRuntimeString(params, "correlationId"),
    workspaceId: getRuntimeString(params, "workspaceId"),
    laneId: getRuntimeString(params, "laneId"),
    sessionId: getRuntimeString(params, "sessionId"),
    terminalId: getRuntimeString(params, "terminalId"),
    data: asString((params as Record<string, unknown>).data),
  };
}

function parseResizeCommand(params: RuntimeCommand): TerminalResizeCommand {
  return {
    correlationId: getRuntimeString(params, "correlationId"),
    workspaceId: getRuntimeString(params, "workspaceId"),
    laneId: getRuntimeString(params, "laneId"),
    sessionId: getRuntimeString(params, "sessionId"),
    terminalId: getRuntimeString(params, "terminalId"),
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

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function findDisallowedSnakeCaseKeys(
  body: Record<string, unknown>,
  keys: readonly string[]
): string[] {
  return keys.filter(key => hasOwn(body, key));
}

function findDisallowedSnakeCaseCommandKeys(
  params: RuntimeCommand,
  keys: readonly string[]
): string[] {
  return keys.filter(key => hasOwn(params, key));
}

function createJsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status });
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
=======
export function createRuntime(options: RuntimeOptions = {}) {
>>>>>>> origin/main
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

<<<<<<< HEAD
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

  function createSnakeCaseCommandError(disallowedKeys: string[]): LocalBusEnvelope {
    return createErrorResponseEnvelope(
      "SNAKE_CASE_NOT_SUPPORTED",
      `snake_case_not_supported:${disallowedKeys.join(",")}`
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
=======
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
>>>>>>> origin/main
      ),
      error: null,
    });
  }

<<<<<<< HEAD
  async function handleCreateSession(match: RegExpMatchArray, req: Request): Promise<Response> {
    const laneId = match[2];
    const lane = lanes.get(laneId);
    if (!lane) {
      return new Response(JSON.stringify(toProtocolRecord({ error: "lane_not_found" })), {
        status: 404,
      });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const disallowedSnakeCaseKeys = findDisallowedSnakeCaseKeys(body, [
      "preferred_transport",
      "codex_session_id",
      "session_id",
      "terminal_id",
      "degrade_reason",
    ]);
    if (disallowedSnakeCaseKeys.length > 0) {
      return createJsonResponse(
        {
          error: "snake_case_not_supported",
          disallowedKeys: disallowedSnakeCaseKeys,
        },
        400
      );
    }

    const preferredTransport = asString(body.preferredTransport);
    const validTransports = ["cliproxy_harness", "native_openai", undefined];

    if (preferredTransport && !validTransports.includes(preferredTransport)) {
      return createJsonResponse({ error: "invalid_preferred_transport" }, 400);
    }

    if (lane.sessionId) {
      const existing = sessions.get(lane.sessionId);
      if (existing) {
        return createJsonResponse(
          {
            sessionId: existing.sessionId,
            transport: existing.transport,
            status: "attached",
            codexSessionId:
              (asString(body.codexSessionId) as string | undefined) || existing.codexSessionId,
            diagnostics: { degradeReason: null },
          },
          200
        );
      }
    }

    const { transport, degradeReason } = await checkHarness();
    sessionCounter += 1;
    const sessionId = `sess_${sessionCounter}`;
    const codexSessionId = asString(body.codexSessionId);
    const sessionRecord: SessionRecord = {
      sessionId,
      laneId,
      transport,
      ...(codexSessionId !== undefined ? { codexSessionId } : {}),
    };
    sessions.set(sessionId, sessionRecord);
    lane.sessionId = sessionId;

    await publishHttpEvent("session.created", { sessionId, laneId, transport });

    return createJsonResponse(
      {
        sessionId,
        transport,
        status: "attached",
        codexSessionId,
        diagnostics: { degradeReason },
      },
      200
    );
  }

  async function handleCreateTerminal(match: RegExpMatchArray, req: Request): Promise<Response> {
    const workspaceId = match[1];
    const laneId = match[2];
    const body = (await req.json()) as Record<string, unknown>;
    const disallowedSnakeCaseKeys = findDisallowedSnakeCaseKeys(body, [
      "preferred_transport",
      "codex_session_id",
      "session_id",
      "terminal_id",
      "degrade_reason",
    ]);
    if (disallowedSnakeCaseKeys.length > 0) {
      return createJsonResponse(
        {
          error: "snake_case_not_supported",
          disallowedKeys: disallowedSnakeCaseKeys,
        },
        400
      );
    }

    const sessionId = asString(body.sessionId);

    const lane = lanes.get(laneId);
    if (!lane) {
      return new Response(JSON.stringify(toProtocolRecord({ error: "lane_not_found" })), {
        status: 404,
      });
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
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

    return createJsonResponse(
      {
        terminalId,
        laneId,
        sessionId,
        state: "active",
      },
      201
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
    return createJsonResponse(
      {
        status: harnessStatus.status,
        degradeReason: harnessStatus.degradeReason,
      },
      200
    );
  }

  async function spawnTerminal(params: RuntimeCommand): Promise<LocalBusEnvelope> {
    const disallowedSnakeCaseKeys = findDisallowedSnakeCaseCommandKeys(params, [
      "command_id",
      "correlation_id",
      "workspace_id",
      "lane_id",
      "session_id",
      "terminal_id",
    ]);
    if (disallowedSnakeCaseKeys.length > 0) {
      return createSnakeCaseCommandError(disallowedSnakeCaseKeys);
    }

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
    const disallowedSnakeCaseKeys = findDisallowedSnakeCaseCommandKeys(params, [
      "command_id",
      "correlation_id",
      "workspace_id",
      "lane_id",
      "session_id",
      "terminal_id",
    ]);
    if (disallowedSnakeCaseKeys.length > 0) {
      return createSnakeCaseCommandError(disallowedSnakeCaseKeys);
    }

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
    const disallowedSnakeCaseKeys = findDisallowedSnakeCaseCommandKeys(params, [
      "command_id",
      "correlation_id",
      "workspace_id",
      "lane_id",
      "session_id",
      "terminal_id",
    ]);
    if (disallowedSnakeCaseKeys.length > 0) {
      return createSnakeCaseCommandError(disallowedSnakeCaseKeys);
    }

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
    // LocalBusEnvelope stays protocol-native snake_case by design.
    return terminals.get(asString((command as Record<string, unknown>).terminal_id) || "");
  }

  function buildTerminalCommandFromBus(command: LocalBusEnvelope): SpawnCommand {
    // Bus-protocol replay/interop still consumes snake_case payload fields.
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
=======
      };
      recordResponse(response);
>>>>>>> origin/main
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
