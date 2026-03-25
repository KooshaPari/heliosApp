import type { LocalBus } from "../protocol/bus.js";
import type { A2AConfig, ProviderHealthStatus } from "./adapter.js";
import { NormalizedProviderError, normalizeError } from "./errors.js";

// biome-ignore lint/style/useNamingConvention: A2A acronym is part of the external provider protocol name.
export interface A2AEndpoint {
  id: string;
  url: string;
  priority: number;
  capabilities: string[];
  healthStatus?: ProviderHealthStatus;
}

// biome-ignore lint/style/useNamingConvention: A2A acronym is part of the external provider protocol name.
export interface A2ADelegation {
  taskDescription: string;
  requiredCapabilities: string[];
  context: Record<string, unknown>;
}

// biome-ignore lint/style/useNamingConvention: A2A acronym is part of the external provider protocol name.
export interface A2AResult {
  endpointId: string;
  result: unknown;
  correlationId: string;
  duration: number;
}

// biome-ignore lint/style/useNamingConvention: A2A acronym is part of the external provider protocol name.
export interface A2ARouterConfig extends A2AConfig {
  endpoints?: Array<{ id: string; url: string; priority: number; capabilities: string[] }>;
}

export function createA2AEndpoints(
  endpoints: NonNullable<A2ARouterConfig["endpoints"]>
): A2AEndpoint[] {
  return endpoints
    .map(endpoint => ({
      id: endpoint.id,
      url: endpoint.url,
      priority: endpoint.priority,
      capabilities: endpoint.capabilities,
      healthStatus: {
        state: "healthy" as const,
        lastCheck: new Date(),
        failureCount: 0,
      },
    }))
    .sort((left, right) => left.priority - right.priority);
}

export function selectA2AEndpoint(
  endpoints: A2AEndpoint[],
  requiredCapabilities: string[]
): A2AEndpoint | undefined {
  let selected = endpoints.find(
    endpoint =>
      endpoint.healthStatus?.state === "healthy" &&
      hasA2ACapabilities(endpoint, requiredCapabilities)
  );

  if (!selected) {
    selected = endpoints.find(
      endpoint =>
        endpoint.healthStatus?.state === "degraded" &&
        hasA2ACapabilities(endpoint, requiredCapabilities)
    );
  }

  if (!selected) {
    selected = endpoints.find(endpoint => hasA2ACapabilities(endpoint, requiredCapabilities));
  }

  return selected;
}

export function hasA2ACapabilities(endpoint: A2AEndpoint, requiredCapabilities: string[]): boolean {
  if (requiredCapabilities.length === 0) {
    return true;
  }

  const endpointCaps = new Set(endpoint.capabilities);
  return requiredCapabilities.every(capability => endpointCaps.has(capability));
}

export async function probeA2AEndpoint(endpoint: A2AEndpoint): Promise<void> {
  await Promise.resolve();

  if (endpoint.url.includes("localhost") || endpoint.url.includes("127.0.0.1")) {
    return;
  }

  return;
}

export async function sendA2ADelegation(
  endpoint: A2AEndpoint,
  delegation: A2ADelegation & { correlationId?: string },
  signal: AbortSignal
): Promise<unknown> {
  await Promise.resolve();

  if (signal.aborted) {
    throw new Error("Delegation cancelled");
  }

  return {
    delegatedAt: new Date().toISOString(),
    endpointId: endpoint.id,
    taskDescription: delegation.taskDescription,
    result: "Mock A2A delegation result",
  };
}

export async function publishA2AEvent(
  bus: LocalBus | null,
  topic: string,
  payload: Record<string, unknown>,
  prefix: string
): Promise<void> {
  if (!bus) {
    return;
  }

  try {
    await bus.publish({
      id: `${prefix}-${Date.now()}-${Math.random()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload,
    });
  } catch (_error) {
    // Best-effort event publishing should not fail provider flow.
  }
}

export function wrapA2AInitError(error: unknown): NormalizedProviderError {
  const normalized = normalizeError(error, "a2a");
  return new NormalizedProviderError(
    "PROVIDER_INIT_FAILED",
    `A2A router init failed: ${normalized.message}`,
    "a2a",
    false
  );
}
