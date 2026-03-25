import type { ProviderHealthStatus } from "../adapter.js";
import { normalizeError } from "../errors.js";

export type HealthTransition = {
  previousState: ProviderHealthStatus["state"];
  newState: ProviderHealthStatus["state"];
  failureCount: number;
};

type HealthCheckResult = {
  status: ProviderHealthStatus;
  transition?: HealthTransition;
};

export async function runHealthCheck(params: {
  current: ProviderHealthStatus;
  probe: () => Promise<boolean>;
  providerId: string;
  timeoutMs: number;
}): Promise<HealthCheckResult> {
  const { current, probe, providerId, timeoutMs } = params;

  try {
    const probeSuccess = await Promise.race([
      probe(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), timeoutMs)
      ),
    ]);

    if (probeSuccess) {
      const next: ProviderHealthStatus = {
        state: "healthy",
        lastCheck: new Date(),
        failureCount: 0,
      };
      const transition: HealthTransition | undefined =
        current.state === "healthy"
          ? undefined
          : { previousState: current.state, newState: "healthy", failureCount: 0 };
      return { status: next, transition };
    }
  } catch (error) {
    const failureCount = current.failureCount + 1;
    let newState: ProviderHealthStatus["state"] = current.state;

    if (failureCount >= 5) {
      newState = "unavailable";
    } else if (failureCount >= 3) {
      newState = "degraded";
    }

    const normalized = normalizeError(
      error,
      providerId as "acp" | "mcp" | "a2a" | "internal"
    );
    const next: ProviderHealthStatus = {
      state: newState,
      lastCheck: new Date(),
      failureCount,
      message: `Health check failed: ${normalized.message}`,
    };
    const transition: HealthTransition | undefined =
      current.state === newState
        ? undefined
        : { previousState: current.state, newState, failureCount };
    return { status: next, transition };
  }

  return { status: { ...current } };
}
