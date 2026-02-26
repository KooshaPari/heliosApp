import type { AuditSink } from "./audit/sink";
import { HarnessRouteSelector, type HarnessProbe } from "./integrations/exec";
import { InMemoryLocalBus } from "./protocol/bus";
import { InMemorySessionRegistry, SessionRegistryError, type SessionTransport } from "./sessions/registry";
import { LaneLifecycleError, LaneLifecycleService } from "./sessions/state_machine";

type RuntimeOptions = {
  auditSink?: AuditSink;
  harnessProbe?: HarnessProbe;
};

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("content_type_must_be_application_json");
  }

  return (await request.json()) as Record<string, unknown>;
}

function asString(body: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`missing_${key}`);
    }
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_${key}`);
  }

  return value;
}

function parsePreferredTransport(body: Record<string, unknown>): SessionTransport | undefined {
  const value = asString(body, "preferred_transport", false);
  if (!value) {
    return undefined;
  }
  if (value !== "cliproxy_harness" && value !== "native_openai") {
    throw new Error("invalid_preferred_transport");
  }
  return value;
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function createRuntime(options: RuntimeOptions = {}) {
  const bus = new InMemoryLocalBus({ auditSink: options.auditSink });
  const laneService = new LaneLifecycleService(bus);
  const sessionRegistry = new InMemorySessionRegistry();
  const harnessRouter = new HarnessRouteSelector(bus, options.harnessProbe);

  const fetch = async (request: Request): Promise<Response> => {
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
        const workspaceId = segments[2];
        const projectContextId = asString(body, "project_context_id") as string;
        const displayName = asString(body, "display_name") as string;
        const lane = await laneService.create({
          workspace_id: workspaceId,
          project_context_id: projectContextId,
          display_name: displayName
        });

        return json(201, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status
        });
      }

      if (
        request.method === "GET" &&
        segments.length === 4 &&
        segments[0] === "v1" &&
        segments[1] === "workspaces" &&
        segments[3] === "lanes"
      ) {
        const workspaceId = segments[2];
        const lanes = laneService.list(workspaceId).map((lane) => ({
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status
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
        const workspaceId = segments[2];
        const laneId = segments[4];
        const lane = await laneService.attach(workspaceId, laneId);
        return json(200, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status
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
        const workspaceId = segments[2];
        const laneId = segments[4];
        const lane = await laneService.cleanup(workspaceId, laneId);
        return json(200, {
          lane_id: lane.lane_id,
          workspace_id: lane.workspace_id,
          status: lane.status
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
        const workspaceId = segments[2];
        const laneId = segments[4];

        const provider = asString(body, "provider") as string;
        if (provider !== "codex") {
          return json(400, { error: "unsupported_provider", details: { provider } });
        }

        const preferredTransport = parsePreferredTransport(body);
        const codexSessionId = asString(body, "codex_session_id", false);

        await laneService.attach(workspaceId, laneId);
        await harnessRouter.refreshHealth();
        const route = harnessRouter.selectRoute(preferredTransport);
        const ensured = sessionRegistry.ensure({
          lane_id: laneId,
          transport: route.transport,
          codex_session_id: codexSessionId
        });

        const sessionCorrelationId = `session.attach:${ensured.session.session_id}:${Date.now()}`;
        await bus.publish({
          id: `session:${ensured.session.session_id}:attach-started:${Date.now()}`,
          type: "event",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: ensured.session.session_id,
          correlation_id: sessionCorrelationId,
          topic: "session.attach.started",
          payload: {
            lane_id: laneId,
            codex_session_id: ensured.session.codex_session_id,
            transport: ensured.session.transport,
            diagnostics: route.diagnostics
          }
        });

        await bus.publish({
          id: `session:${ensured.session.session_id}:attach-succeeded:${Date.now()}`,
          type: "event",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: ensured.session.session_id,
          correlation_id: sessionCorrelationId,
          topic: "session.attached",
          payload: {
            lane_id: laneId,
            codex_session_id: ensured.session.codex_session_id,
            transport: ensured.session.transport,
            diagnostics: route.diagnostics
          }
        });

        if (ensured.created) {
          await bus.publish({
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
              diagnostics: route.diagnostics
            }
          });
        }

        return json(200, {
          session_id: ensured.session.session_id,
          lane_id: ensured.session.lane_id,
          codex_session_id: ensured.session.codex_session_id,
          transport: ensured.session.transport,
          status: ensured.session.status,
          diagnostics: route.diagnostics
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
        const workspaceId = segments[2];
        const laneId = segments[4];
        const sessionId = asString(body, "session_id") as string;
        const title = asString(body, "title", false);

        const session = sessionRegistry.get(sessionId);
        if (!session) {
          return json(404, { error: "session_not_found", details: { session_id: sessionId } });
        }
        if (session.lane_id !== laneId) {
          return json(409, { error: "session_lane_mismatch", details: { session_id: sessionId, lane_id: laneId } });
        }
        if (session.status === "terminated") {
          return json(409, { error: "session_terminated", details: { session_id: sessionId } });
        }

        const terminalId = `term_${crypto.randomUUID()}`;
        const correlationId = `terminal.spawn:${terminalId}:${Date.now()}`;

        await bus.publish({
          id: `terminal:${terminalId}:spawn-started:${Date.now()}`,
          type: "event",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          correlation_id: correlationId,
          topic: "terminal.spawn.started",
          payload: {
            lane_id: laneId,
            session_id: sessionId,
            title: title ?? null
          }
        });

        await bus.publish({
          id: `terminal:${terminalId}:spawned:${Date.now()}`,
          type: "event",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          terminal_id: terminalId,
          correlation_id: correlationId,
          topic: "terminal.spawned",
          payload: {
            lane_id: laneId,
            session_id: sessionId,
            terminal_id: terminalId,
            state: "active"
          }
        });

        return json(201, {
          terminal_id: terminalId,
          lane_id: laneId,
          session_id: sessionId,
          state: "active"
        });
      }

      if (request.method === "GET" && url.pathname === "/v1/harness/cliproxy/status") {
        const status = await harnessRouter.refreshHealth();
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

  return {
    bus,
    fetch,
    listLanes: (workspaceId: string) => laneService.list(workspaceId),
    cleanupLane: (workspaceId: string, laneId: string) => laneService.cleanup(workspaceId, laneId),
    getState: () => bus.getState(),
    getEvents: () => bus.getEvents(),
    getAuditRecords: () => bus.getAuditRecords(),
    getHarnessStatus: () => harnessRouter.getStatus(),
    getSession: (sessionId: string) => sessionRegistry.get(sessionId)
  };
}
