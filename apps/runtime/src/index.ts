/**
 * @helios/runtime — Core runtime package for heliosApp.
 *
 * Exports foundational types, utilities, and service APIs consumed by all other packages.
 *
 * ## Service Architecture
 *
 * The runtime is organized into four key services, each maintaining clear boundaries
 * and exported through a unified public API:
 *
 * - **PTY Service** (`services/pty`): Pseudo-terminal management
 * - **Renderer Service** (`services/renderer`): UI rendering and switching
 * - **Secrets Service** (`services/secrets`): Credential and sensitive data management
 * - **Lanes Service** (`services/lanes`): Workspace/lane orchestration
 *
 * Import services via: `import { ptyService, rendererService, secretsService, lanesService } from '@helios/runtime/services'`
 */

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

const startTime = performance.now();

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
  };
}

// Re-export all services as a unified API
export * from "./services/index.js";
