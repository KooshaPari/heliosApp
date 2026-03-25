import type { SessionTransport } from "../sessions/registry";
import { LaneLifecycleService } from "../sessions/state_machine";
import { ProtocolValidationError } from "../protocol/types";

export function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("content_type_must_be_application_json");
  }
  return (await request.json()) as Record<string, unknown>;
}

export function asString(
  body: Record<string, unknown>,
  key: string,
  required = true,
): string | undefined {
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

export function parsePreferredTransport(
  body: Record<string, unknown>,
): SessionTransport | undefined {
  const value = asString(body, "preferred_transport", false);
  if (!value) {
    return undefined;
  }
  if (value !== "cliproxy_harness" && value !== "native_openai") {
    throw new Error("invalid_preferred_transport");
  }
  return value;
}

export function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function requiredSegment(segments: string[], index: number, name: string): string {
  const value = segments[index];
  if (!value) {
    throw new Error(`missing_path_${name}`);
  }
  return value;
}

function isLifecycleOrderingViolation(error: unknown, topic: string): boolean {
  return (
    error instanceof ProtocolValidationError &&
    error.code === "ORDERING_VIOLATION" &&
    error.message.includes(topic)
  );
}

export async function attachLaneForHttpLifecycle(
  laneService: LaneLifecycleService,
  workspaceId: string,
  laneId: string,
) {
  try {
    return await laneService.attach(workspaceId, laneId);
  } catch (error) {
    if (isLifecycleOrderingViolation(error, "lane.attached")) {
      return laneService.getRequired(laneId);
    }
    throw error;
  }
}

export async function cleanupLaneForHttpLifecycle(
  laneService: LaneLifecycleService,
  workspaceId: string,
  laneId: string,
) {
  try {
    return await laneService.cleanup(workspaceId, laneId);
  } catch (error) {
    if (isLifecycleOrderingViolation(error, "lane.cleaned")) {
      return laneService.getRequired(laneId);
    }
    throw error;
  }
}
