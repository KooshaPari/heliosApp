/**
 * Rio renderer registration with feature flag gate.
 *
 * When the feature flag is disabled (default), this module returns
 * immediately with zero runtime cost — no dynamic imports, no object
 * allocation, no process spawning.
 */

import type { RendererRegistry } from "../registry.js";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/**
 * Minimal app-config shape needed by the rio gate.
 * The real AppConfig lives elsewhere; we only require the slice we read.
 */
export interface RioFeatureFlagConfig {
  featureFlags?: {
    rioRenderer?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Feature-flag utility
// ---------------------------------------------------------------------------

/**
 * Check whether the rio renderer is enabled in the given config.
 *
 * Returns `false` when the key is missing or explicitly set to `false`.
 */
export function isRioEnabled(config: RioFeatureFlagConfig): boolean {
  return config.featureFlags?.rioRenderer === true;
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

/**
 * Detect whether the `rio` binary is available on the system PATH.
 */
export async function detectRioBinary(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "rio"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the rio renderer backend if the feature flag is enabled and
 * the rio binary is available.
 *
 * Zero-cost when the flag is off: no dynamic import, no object creation.
 */
export async function registerRio(
  registry: RendererRegistry,
  config: RioFeatureFlagConfig,
): Promise<void> {
  if (!isRioEnabled(config)) {
    // Zero-cost path: do nothing.
    if (typeof console !== "undefined") {
      console.debug("Rio renderer: disabled by feature flag");
    }
    return;
  }

  // Feature flag is on — dynamically load the backend module.
  let backendModule: typeof import("./backend.js");
  try {
    backendModule = await import("./backend.js");
  } catch (err) {
    console.error("Rio renderer: failed to load backend module", err);
    return;
  }

  // Detect binary availability.
  const available = await detectRioBinary();
  if (!available) {
    console.warn(
      "Rio renderer: feature flag is enabled but rio binary not found on PATH",
    );
    return;
  }

  // Create and register.
  const backend = new backendModule.RioBackend();
  registry.register(backend);
}
