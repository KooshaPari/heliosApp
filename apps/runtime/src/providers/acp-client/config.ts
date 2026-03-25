import type { ACPConfig } from "../adapter.js";

export function validateAcpConfig(config: ACPConfig): void {
  if (!config.endpoint || typeof config.endpoint !== "string") {
    throw new Error("Missing or invalid endpoint");
  }

  if (!config.apiKeyRef || typeof config.apiKeyRef !== "string") {
    throw new Error("Missing or invalid apiKeyRef");
  }

  if (!config.model || typeof config.model !== "string") {
    throw new Error("Missing or invalid model");
  }
}

export function resolveHealthCheckInterval(config: ACPConfig): number {
  return config.healthCheckIntervalMs || 30000;
}
