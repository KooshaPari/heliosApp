import type { ProtocolBus as LocalBus } from "../../runtime/src/protocol/bus.ts";
import type { LocalBusEnvelope } from "../../runtime/src/protocol/types.ts";
import type { RuntimeState } from "../../runtime/src/sessions/state_machine.ts";
import type { TransportDiagnostics } from "./context_store.ts";
import type { RendererEngine } from "./settings.ts";

type RuntimeResponse<T extends Record<string, unknown>> = {
  ok: boolean;
  result: T | null;
  error: string | null;
};

export type LifecycleResult = {
  ok: boolean;
  runtimeState: RuntimeState | null;
  id: string | null;
  diagnostics: TransportDiagnostics;
  error: string | null;
};

export type RendererCapabilities = {
  activeEngine: RendererEngine;
  availableEngines: RendererEngine[];
  hotSwapSupported: boolean;
};

export type RendererSwitchResult = {
  ok: boolean;
  activeEngine: RendererEngine;
  previousEngine: RendererEngine;
  error: string | null;
};

function toProtocolName(value: string): string {
  return value.replace(/[A-Z]/g, "_$&").toLowerCase();
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

function toProtocolRecord(value: Record<string, unknown>): Record<string, unknown> {
  const protocol: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue === undefined) {
      continue;
    }
    const protocolKey = toProtocolName(key);
    protocol[protocolKey] = toProtocolValue(rawValue);
  }
  return protocol;
}

function toCommandEnvelope(
  method: string,
  payload: Record<string, unknown>,
  workspaceId: string | null,
  laneId: string | null,
  sessionId: string | null,
  terminalId: string | null
): LocalBusEnvelope {
  const correlationId = `${method}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  return toProtocolRecord({
    id: correlationId,
    type: "command",
    ts: new Date().toISOString(),
    method,
    correlationId,
    workspaceId: workspaceId ?? undefined,
    laneId: laneId ?? undefined,
    sessionId: sessionId ?? undefined,
    terminalId: terminalId ?? undefined,
    payload,
  }) as LocalBusEnvelope;
}

function toResponse<T extends Record<string, unknown>>(
  response: LocalBusEnvelope
): RuntimeResponse<T> {
  if (response.status === "error") {
    return {
      ok: false,
      result: null,
      error: response.error?.message ?? "runtime request failed",
    };
  }

  return {
    ok: true,
    result: (response.result as T | null) ?? null,
    error: null,
  };
}

function normalizeDiagnostics(result: Record<string, unknown> | null): TransportDiagnostics {
  const diagnostics = (result?.diagnostics as Record<string, unknown> | undefined) ?? {};
  return {
    preferredTransport:
      typeof diagnostics.preferred_transport === "string"
        ? diagnostics.preferred_transport
        : "cliproxy_harness",
    resolvedTransport:
      typeof diagnostics.resolved_transport === "string"
        ? diagnostics.resolved_transport
        : "cliproxy_harness",
    degradedReason:
      typeof diagnostics.degraded_reason === "string" ? diagnostics.degraded_reason : null,
    degradedAt: typeof diagnostics.degraded_at === "string" ? diagnostics.degraded_at : null,
  };
}

export class DesktopRuntimeClient {
  constructor(private readonly bus: LocalBus) {}

  async createLane(input: {
    workspaceId: string;
    preferredTransport?: string;
    simulateDegrade?: boolean;
    forceError?: boolean;
  }): Promise<LifecycleResult> {
    const requestedLaneId = `${input.workspaceId}:lane`;
    const response = await this.bus.request(
      toCommandEnvelope(
        "lane.create",
        {
          id: requestedLaneId,
          laneId: requestedLaneId,
          preferredTransport: input.preferredTransport ?? "cliproxy_harness",
          simulateDegrade: input.simulateDegrade === true,
          forceError: input.forceError === true,
        },
        input.workspaceId,
        requestedLaneId,
        null,
        null
      )
    );
    const parsed = toResponse<Record<string, unknown>>(response);
    return {
      ok: parsed.ok,
      runtimeState: (parsed.result?.state as RuntimeState | undefined) ?? null,
      id: typeof parsed.result?.lane_id === "string" ? parsed.result.lane_id : null,
      diagnostics: normalizeDiagnostics(parsed.result),
      error: parsed.error,
    };
  }

  async ensureSession(input: {
    workspaceId: string;
    laneId: string;
    forceError?: boolean;
  }): Promise<LifecycleResult> {
    const requestedSessionId = `${input.laneId}:session`;
    const response = await this.bus.request(
      toCommandEnvelope(
        "session.attach",
        {
          id: requestedSessionId,
          laneId: input.laneId,
          sessionId: requestedSessionId,
          forceError: input.forceError === true,
        },
        input.workspaceId,
        input.laneId,
        requestedSessionId,
        null
      )
    );
    const parsed = toResponse<Record<string, unknown>>(response);
    return {
      ok: parsed.ok,
      runtimeState: (parsed.result?.state as RuntimeState | undefined) ?? null,
      id: typeof parsed.result?.session_id === "string" ? parsed.result.session_id : null,
      diagnostics: normalizeDiagnostics(parsed.result),
      error: parsed.error,
    };
  }

  async spawnTerminal(input: {
    workspaceId: string;
    laneId: string;
    sessionId: string;
    forceError?: boolean;
  }): Promise<LifecycleResult> {
    const requestedTerminalId = `${input.sessionId}:terminal`;
    const response = await this.bus.request(
      toCommandEnvelope(
        "terminal.spawn",
        {
          id: requestedTerminalId,
          laneId: input.laneId,
          sessionId: input.sessionId,
          terminalId: requestedTerminalId,
          forceError: input.forceError === true,
        },
        input.workspaceId,
        input.laneId,
        input.sessionId,
        requestedTerminalId
      )
    );
    const parsed = toResponse<Record<string, unknown>>(response);
    return {
      ok: parsed.ok,
      runtimeState: (parsed.result?.state as RuntimeState | undefined) ?? null,
      id: typeof parsed.result?.terminal_id === "string" ? parsed.result.terminal_id : null,
      diagnostics: normalizeDiagnostics(parsed.result),
      error: parsed.error,
    };
  }

  async getRendererCapabilities(workspaceId: string | null): Promise<RendererCapabilities> {
    const response = await this.bus.request(
      toCommandEnvelope("renderer.capabilities", {}, workspaceId, null, null, null)
    );
    const parsed = toResponse<Record<string, unknown>>(response);
    const activeEngine = parsed.result?.active_engine === "rio" ? "rio" : "ghostty";
    const available = Array.isArray(parsed.result?.available_engines)
      ? parsed.result.available_engines.filter(
          (value): value is RendererEngine => value === "ghostty" || value === "rio"
        )
      : (["ghostty", "rio"] as RendererEngine[]);
    return {
      activeEngine,
      availableEngines: available,
      hotSwapSupported: parsed.result?.hot_swap_supported !== false,
    };
  }

  async switchRenderer(input: {
    workspaceId: string | null;
    targetEngine: RendererEngine;
    forceError?: boolean;
  }): Promise<RendererSwitchResult> {
    const response = await this.bus.request(
      toCommandEnvelope(
        "renderer.switch",
        {
          targetEngine: input.targetEngine,
          forceError: input.forceError === true,
        },
        input.workspaceId,
        null,
        null,
        null
      )
    );
    const parsed = toResponse<Record<string, unknown>>(response);
    return {
      ok: parsed.ok,
      activeEngine: parsed.result?.active_engine === "rio" ? "rio" : "ghostty",
      previousEngine: parsed.result?.previous_engine === "rio" ? "rio" : "ghostty",
      error: parsed.error,
    };
  }
}
