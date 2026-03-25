import { type HarnessRouteSelector, buildSpawnTerminalCommand } from "../integrations/exec.ts";
import type { ProtocolMethod } from "../protocol/methods.ts";
import type { LocalBusEnvelope } from "../protocol/types.ts";
import { type InMemorySessionRegistry, SessionRegistryError } from "../sessions/registry.ts";
import { LaneLifecycleError, type LaneLifecycleService } from "../sessions/state_machine.ts";
import {
  asString,
  attachLaneForHttpLifecycle,
  cleanupLaneForHttpLifecycle,
  json,
  parseBody,
  parsePreferredTransport,
  requiredSegment,
  splitPath,
} from "./http_utils.ts";

type BoundaryDispatcher = (command: LocalBusEnvelope) => Promise<LocalBusEnvelope>;

type RuntimeBus = {
  publish(event: LocalBusEnvelope): Promise<void>;
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
};

type RuntimeHttpDispatcherOptions = {
  bus: RuntimeBus;
  dispatchBoundaryCommand: BoundaryDispatcher;
  harnessRouter: HarnessRouteSelector;
  laneService: LaneLifecycleService;
  sessionRegistry: InMemorySessionRegistry;
};

export function createRuntimeHttpHandler(options: RuntimeHttpDispatcherOptions) {
  return async function handleFetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = splitPath(url.pathname);

    try {
      if (
        request.method === "POST" &&
        segments.length === 4 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes"
      ) {
        const body = await parseBody(request);
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const projectContextId = asString(body, "project_context_id") as string;
        const displayName = asString(body, "display_name") as string;
        const lane = await options.laneService.create({
          workspace_id: workspaceId,
          project_context_id: projectContextId,
          display_name: displayName,
        });
        return json(201, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status,
        });
      }

      if (
        request.method === "GET" &&
        segments.length === 4 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes"
      ) {
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const lanes = options.laneService.list(workspaceId).map(lane => ({
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status,
        }));
        return json(200, { items: lanes });
      }

      if (
        request.method === "POST" &&
        segments.length === 6 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes" &&
        segments[5] === "attach"
      ) {
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const laneId = requiredSegment(segments, 4, "lane_id");
        const lane = await attachLaneForHttpLifecycle(options.laneService, workspaceId, laneId);
        return json(200, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status,
        });
      }

      if (
        request.method === "POST" &&
        segments.length === 6 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes" &&
        segments[5] === "cleanup"
      ) {
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const laneId = requiredSegment(segments, 4, "lane_id");
        const lane = await cleanupLaneForHttpLifecycle(options.laneService, workspaceId, laneId);
        return json(200, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status,
        });
      }

      if (
        request.method === "POST" &&
        segments.length === 6 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes" &&
        segments[5] === "sessions"
      ) {
        const body = await parseBody(request);
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const laneId = requiredSegment(segments, 4, "lane_id");
        const provider = asString(body, "provider") as string;

        if (provider !== "codex") {
          return json(400, { error: "unsupported_provider", details: { provider } });
        }

        const preferredTransport = parsePreferredTransport(body);
        const codexSessionId = asString(body, "codex_session_id", false);

        await attachLaneForHttpLifecycle(options.laneService, workspaceId, laneId);
        await options.harnessRouter.refreshHealth();
        const route = options.harnessRouter.selectRoute(preferredTransport);
        const ensured = options.sessionRegistry.ensure({
          lane_id: laneId,
          transport: route.transport,
          codex_session_id: codexSessionId,
        });

        const sessionCorrelationId = `session.attach:${ensured.session.session_id}:${Date.now()}`;
        const attachResponse = await options.bus.request({
          id: `session:${ensured.session.session_id}:attach:${Date.now()}`,
          type: "command",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: ensured.session.session_id,
          correlation_id: sessionCorrelationId,
          method: "session.attach",
          payload: {
            id: ensured.session.session_id,
            lane_id: laneId,
            codex_session_id: ensured.session.codex_session_id,
            transport: ensured.session.transport,
            diagnostics: route.diagnostics,
          },
        });

        if (attachResponse.status === "error") {
          return json(409, {
            error: attachResponse.error?.code ?? "session_attach_failed",
            details: {
              code: attachResponse.error?.code ?? null,
              message: attachResponse.error?.message ?? null,
              retryable: attachResponse.error?.retryable ?? false,
            },
          });
        }

        if (ensured.created) {
          await options.bus.publish({
            id: `session:${ensured.session.session_id}:created:${Date.now()}`,
            type: "event",
            ts: new Date().toISOString(),
            workspace_id: workspaceId,
            lane_id: laneId,
            session_id: ensured.session.session_id,
            topic: "session.created",
            payload: {
              lane_id: laneId,
              codex_session_id: ensured.session.codex_session_id,
              transport: ensured.session.transport,
              diagnostics: route.diagnostics,
            },
          });
        }

        return json(200, {
          session_id: ensured.session.session_id,
          lane_id: ensured.session.lane_id,
          codex_session_id: ensured.session.codex_session_id,
          transport: ensured.session.transport,
          status: ensured.session.status,
          diagnostics: route.diagnostics,
        });
      }

      if (
        request.method === "POST" &&
        segments.length === 6 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes" &&
        segments[5] === "terminals"
      ) {
        const body = await parseBody(request);
        const workspaceId = requiredSegment(segments, 2, "workspace_id");
        const laneId = requiredSegment(segments, 4, "lane_id");
        const sessionId = asString(body, "session_id") as string;
        const title = asString(body, "title", false);
        const lane = options.laneService.getRequired(laneId);

        if (lane.workspace_id !== workspaceId) {
          return json(409, { error: `lane ${laneId} does not belong to workspace ${workspaceId}` });
        }
        if (lane.status === "closed") {
          return json(409, { error: "lane_closed", details: { lane_id: laneId } });
        }

        const session = options.sessionRegistry.get(sessionId);
        if (!session) {
          return json(404, { error: "session_not_found", details: { session_id: sessionId } });
        }
        if (session.lane_id !== laneId) {
          return json(409, {
            error: "session_lane_mismatch",
            details: { session_id: sessionId, lane_id: laneId },
          });
        }
        if (session.status === "terminated") {
          return json(409, { error: "session_terminated", details: { session_id: sessionId } });
        }

        const terminalId = `term_${crypto.randomUUID()}`;
        const correlationId = `terminal.spawn:${terminalId}:${Date.now()}`;
        const response = await options.dispatchBoundaryCommand(
          buildSpawnTerminalCommand({
            command_id: `cmd:terminal.spawn:${terminalId}`,
            correlation_id: correlationId,
            workspace_id: workspaceId,
            lane_id: laneId,
            session_id: sessionId,
            terminal_id: terminalId,
            title: title ?? undefined,
          })
        );

        if (response.type !== "response") {
          return json(500, { error: "terminal_spawn_invalid_response" });
        }
        if (response.status === "error") {
          return json(409, {
            error: "terminal_spawn_failed",
            details: {
              code: response.error?.code ?? null,
              message: response.error?.message ?? null,
              retryable: response.error?.retryable ?? false,
            },
          });
        }

        return json(201, {
          ...(response.result as Record<string, unknown>),
          state: "active",
        });
      }

      if (request.method === "POST" && url.pathname === "/v1/protocol/dispatch") {
        const body = await parseBody(request);
        const method = asString(body, "method") as ProtocolMethod;
        const payload = (body.payload as Record<string, unknown> | undefined) ?? {};
        const response = await options.dispatchBoundaryCommand({
          id: `dispatch:${method}:${Date.now()}`,
          type: "command",
          ts: new Date().toISOString(),
          method,
          payload,
          correlation_id: asString(body, "correlation_id", false),
          workspace_id: asString(body, "workspace_id", false),
          lane_id: asString(body, "lane_id", false),
          session_id: asString(body, "session_id", false),
          terminal_id: asString(body, "terminal_id", false),
        });

        if (response.type !== "response") {
          return json(500, { error: "invalid_boundary_response" });
        }
        if (response.status === "error") {
          return json(409, {
            error: response.error?.code ?? "boundary_dispatch_failed",
            message: response.error?.message ?? "boundary_dispatch_failed",
            details: response.error?.details ?? null,
          });
        }

        return json(200, (response.result as Record<string, unknown>) ?? {});
      }

      if (request.method === "GET" && url.pathname === "/v1/harness/cliproxy/status") {
        const status = await options.harnessRouter.refreshHealth();
        return json(200, status);
      }

      return json(404, { error: "not_found" });
    } catch (error) {
      if (error instanceof SessionRegistryError || error instanceof LaneLifecycleError) {
        return json(409, { error: error.message });
      }
      if (error instanceof Error) {
        return json(400, { error: error.message });
      }
      return json(500, { error: "internal_error" });
    }
  };
}
