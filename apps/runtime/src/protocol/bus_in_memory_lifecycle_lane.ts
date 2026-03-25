import {
  type InMemoryBusContext,
  buildErrorResponse,
  buildOkResponse,
  emitMetricEvent,
  publishLifecycleEvent,
  recordMetric,
} from "./bus_in_memory_support.js";
import type { LocalBusEnvelope } from "./types.js";

const DIAGNOSTICS = {
  preferred_transport: "cliproxy_harness",
  resolved_transport: "cliproxy_harness",
  degraded_reason: null,
  degraded_at: null,
};

export function handleLaneLifecycleRequest(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
  method: "lane.attach" | "lane.create" | "lane.cleanup",
  startTime: number
): LocalBusEnvelope {
  const payload =
    command.payload && typeof command.payload === "object"
      ? (command.payload as Record<string, unknown>)
      : {};

  switch (method) {
    case "lane.attach": {
      publishLifecycleEvent(context, "lane.attach.started", command);

      if (payload.force_error === true) {
        publishLifecycleEvent(context, "lane.attach.failed", command);
        return buildErrorResponse(command, "LANE_ATTACH_FAILED", "forced error");
      }

      publishLifecycleEvent(context, "lane.attached", command);
      const laneId = command.lane_id ?? payload.id ?? payload.lane_id ?? `lane_${Date.now()}`;
      recordMetric(context, "lane_attach_latency_ms", Date.now() - startTime);
      emitMetricEvent(context, "lane_attach_latency_ms", Date.now() - startTime);
      return buildOkResponse(command, {
        lane_id: laneId,
        state: context.stateRef.current,
        diagnostics: DIAGNOSTICS,
      });
    }
    case "lane.create": {
      publishLifecycleEvent(context, "lane.create.started", command);
      publishLifecycleEvent(context, "lane.created", command);

      recordMetric(context, "lane_create_latency_ms", Date.now() - startTime);
      emitMetricEvent(context, "lane_create_latency_ms", Date.now() - startTime);

      const laneId = payload.id ?? payload.lane_id ?? `lane_${Date.now()}`;
      const preferredTransport =
        typeof payload.preferred_transport === "string"
          ? payload.preferred_transport
          : "cliproxy_harness";
      const degraded = payload.simulate_degrade === true;
      const resolvedTransport = degraded ? "native_openai" : preferredTransport;
      const degradedReason = degraded ? "cliproxy_harness_unhealthy" : null;

      return buildOkResponse(command, {
        lane_id: laneId,
        state: context.stateRef.current,
        diagnostics: {
          preferred_transport: preferredTransport,
          resolved_transport: resolvedTransport,
          degraded_reason: degradedReason,
          degraded_at: degraded ? new Date().toISOString() : null,
        },
      });
    }
    case "lane.cleanup": {
      publishLifecycleEvent(context, "lane.cleanup.started", command);

      if (payload.force_error === true) {
        publishLifecycleEvent(context, "lane.cleanup.failed", command);
        return buildErrorResponse(command, "LANE_CLEANUP_FAILED", "forced error");
      }

      publishLifecycleEvent(context, "lane.cleaned", command);
      const laneId = command.lane_id ?? payload.id ?? payload.lane_id ?? `lane_${Date.now()}`;
      recordMetric(context, "lane_cleanup_latency_ms", Date.now() - startTime);
      emitMetricEvent(context, "lane_cleanup_latency_ms", Date.now() - startTime);
      return buildOkResponse(command, {
        lane_id: laneId,
        state: context.stateRef.current,
      });
    }
  }
}
