import type { LocalBusEnvelope } from "./types.js";
import {
  buildErrorResponse,
  buildOkResponse,
  emitMetricEvent,
  publishLifecycleEvent,
  recordMetric,
  type InMemoryBusContext,
} from "./bus_in_memory_support.js";

const DIAGNOSTICS = {
  preferred_transport: "cliproxy_harness",
  resolved_transport: "cliproxy_harness",
  degraded_reason: null,
  degraded_at: null,
};

export function handleSessionLifecycleRequest(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
  method: "session.attach" | "session.terminate",
  startTime: number,
): LocalBusEnvelope {
  const payload = command.payload && typeof command.payload === "object"
    ? (command.payload as Record<string, unknown>)
    : {};

  switch (method) {
    case "session.attach": {
      const boundaryFailure = payload.boundary_failure === "harness";
      publishLifecycleEvent(context, "session.attach.started", command);

      if (payload.force_error === true || boundaryFailure) {
        publishLifecycleEvent(context, "session.attach.failed", command);
        context.stateRef.current = { session: "detached" };
        return buildErrorResponse(
          command,
          boundaryFailure ? "HARNESS_UNAVAILABLE" : "SESSION_ATTACH_FAILED",
          boundaryFailure ? "harness unavailable" : "forced error",
        );
      }

      if (payload.restore === true) {
        const restoreStart = Date.now();
        publishLifecycleEvent(context, "session.restore.started", command);
        recordMetric(context, "session_restore_latency_ms", Date.now() - restoreStart);
        emitMetricEvent(context, "session_restore_latency_ms", Date.now() - restoreStart);
      }

      publishLifecycleEvent(context, "session.attached", command);
      if (payload.restore === true) {
        publishLifecycleEvent(context, "session.restore.completed", command);
      }

      context.stateRef.current = { session: "attached" };
      const sessionId =
        command.session_id ?? payload.id ?? payload.session_id ?? `session_${Date.now()}`;
      return buildOkResponse(command, {
        session_id: sessionId,
        state: context.stateRef.current,
        diagnostics: DIAGNOSTICS,
      });
    }
    case "session.terminate": {
      publishLifecycleEvent(context, "session.terminate.started", command);

      if (payload.force_error === true) {
        publishLifecycleEvent(context, "session.terminate.failed", command);
        return buildErrorResponse(command, "SESSION_TERMINATE_FAILED", "forced error");
      }

      context.stateRef.current = { session: "detached" };
      publishLifecycleEvent(context, "session.terminated", command);
      const sessionId = payload.id ?? payload.session_id ?? `session_${Date.now()}`;
      recordMetric(context, "session_terminate_latency_ms", Date.now() - startTime);
      emitMetricEvent(context, "session_terminate_latency_ms", Date.now() - startTime);
      return buildOkResponse(command, {
        session_id: sessionId,
        state: context.stateRef.current,
      });
    }
  }
}
