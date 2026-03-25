import type { LocalBusEnvelope } from "./types.js";
import {
  buildErrorResponse,
  buildMethodNotSupportedResponse,
  buildMissingCorrelationResponse,
  buildOkResponse,
  emitMetricEvent,
  hasTopLevelDataField,
  payloadRecord,
  publishLifecycleEvent,
  recordMetric,
  type InMemoryBusContext,
} from "./bus_in_memory_support.js";
import { handleLifecycleRequest } from "./bus_in_memory_lifecycle.js";

const NEEDS_CORRELATION = new Set([
  "lane.attach",
  "lane.cleanup",
  "lane.create",
  "session.attach",
  "session.terminate",
  "terminal.spawn",
  "terminal.input",
  "terminal.resize",
]);

export async function handleInMemoryRequest(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
): Promise<LocalBusEnvelope> {
  await Promise.resolve();

  if (!command.method) {
    return buildMethodNotSupportedResponse(command);
  }
  if (NEEDS_CORRELATION.has(command.method) && !command.correlation_id) {
    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "error",
      error: {
        code: "MISSING_CORRELATION_ID",
        message: "correlation_id is required",
        retryable: false,
      },
    };
  }

  const startTime = Date.now();
  switch (command.method) {
    case "lane.attach":
    case "lane.create":
    case "lane.cleanup":
    case "session.attach":
    case "session.terminate":
      return handleLifecycleRequest(context, command, command.method, startTime);
    case "terminal.spawn":
      return handleTerminalSpawn(context, command, startTime);
    case "terminal.input":
      return handleTerminalInput(command);
    case "renderer.capabilities":
      return buildOkResponse(command, {
        active_engine: context.rendererEngineRef.current,
        available_engines: ["ghostty", "rio"],
        hot_swap_supported: true,
      });
    case "renderer.switch":
      return handleRendererSwitch(context, command);
    default:
      return buildMethodNotSupportedResponse(command);
  }
}

function handleTerminalSpawn(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
  startTime: number,
): LocalBusEnvelope {
  const correlationId = command.correlation_id;
  if (!correlationId) {
    return buildMissingCorrelationResponse("terminal.spawn");
  }

  const payload = payloadRecord(command.payload);
  const progress =
    context.lifecycleProgress.get(correlationId) ??
    (() => {
      const created = new Set<string>();
      context.lifecycleProgress.set(correlationId, created);
      return created;
    })();

  progress.add("terminal.spawn.started");
  publishLifecycleEvent(context, "terminal.spawn.started", command);

  if (payload.force_error === true) {
    progress.add("terminal.spawn.failed");
    publishLifecycleEvent(context, "terminal.spawn.failed", command);
    return buildErrorResponse(command, "TERMINAL_SPAWN_FAILED", "forced error");
  }

  publishLifecycleEvent(context, "terminal.state.changed", command);
  context.stateRef.current = { ...context.stateRef.current, terminal: "active" };
  publishLifecycleEvent(context, "terminal.state.changed", command);
  progress.add("terminal.spawned");
  publishLifecycleEvent(context, "terminal.spawned", command);

  const terminalId = payload.id ?? payload.terminal_id ?? `terminal_${Date.now()}`;
  recordMetric(context, "terminal_spawn_latency_ms", Date.now() - startTime);
  emitMetricEvent(context, "terminal_spawn_latency_ms", Date.now() - startTime);
  return buildOkResponse(command, {
    terminal_id: terminalId,
    lane_id: command.lane_id ?? null,
    session_id: command.session_id ?? null,
    state: context.stateRef.current,
    diagnostics: {
      preferred_transport: "cliproxy_harness",
      resolved_transport: "cliproxy_harness",
      degraded_reason: null,
      degraded_at: null,
    },
  });
}

function handleTerminalInput(command: LocalBusEnvelope): LocalBusEnvelope {
  const payload = payloadRecord(command.payload);
  if (payload.data === undefined && !hasTopLevelDataField(command)) {
    return buildErrorResponse(command, "INVALID_TERMINAL_INPUT", "payload.data is required");
  }

  return buildOkResponse(command, {});
}

function handleRendererSwitch(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
): LocalBusEnvelope {
  const payload = payloadRecord(command.payload);
  const previousEngine = context.rendererEngineRef.current;
  if (payload.force_error === true) {
    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "error",
      error: {
        code: "RENDERER_SWITCH_FAILED",
        message: "forced error",
        retryable: false,
      },
      result: {
        active_engine: previousEngine,
        previous_engine: previousEngine,
      },
    };
  }

  context.rendererEngineRef.current = payload.target_engine === "rio" ? "rio" : "ghostty";
  return buildOkResponse(command, {
    active_engine: context.rendererEngineRef.current,
    previous_engine: previousEngine,
  });
}
