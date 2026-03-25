import { handleLaneLifecycleRequest } from "./bus_in_memory_lifecycle_lane.js";
import { handleSessionLifecycleRequest } from "./bus_in_memory_lifecycle_session.js";
import {
  type InMemoryBusContext,
  buildMissingCorrelationResponse,
  ensureLifecycleProgress,
  payloadRecord,
} from "./bus_in_memory_support.js";
import type { LocalBusEnvelope } from "./types.js";

type LifecycleMethod =
  | "lane.attach"
  | "lane.create"
  | "lane.cleanup"
  | "session.attach"
  | "session.terminate";

export function handleLifecycleRequest(
  context: InMemoryBusContext,
  command: LocalBusEnvelope,
  method: LifecycleMethod,
  startTime: number
): LocalBusEnvelope {
  const correlationId = command.correlation_id;
  if (!correlationId) {
    return buildMissingCorrelationResponse(method);
  }

  const _payload = payloadRecord(command.payload);
  const progress = ensureLifecycleProgress(context.lifecycleProgress, correlationId);

  switch (method) {
    case "lane.attach": {
      progress.add("lane.attach.started");
      return handleLaneLifecycleRequest(context, command, method, startTime);
    }
    case "lane.create": {
      progress.add("lane.create.started");
      return handleLaneLifecycleRequest(context, command, method, startTime);
    }
    case "lane.cleanup": {
      progress.add("lane.cleanup.started");
      return handleLaneLifecycleRequest(context, command, method, startTime);
    }
    case "session.attach": {
      progress.add("session.attach.started");
      return handleSessionLifecycleRequest(context, command, method, startTime);
    }
    case "session.terminate": {
      progress.add("session.terminate.started");
      return handleSessionLifecycleRequest(context, command, method, startTime);
    }
  }
}
