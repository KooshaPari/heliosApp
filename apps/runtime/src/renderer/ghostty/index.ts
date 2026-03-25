/**
 * Ghostty renderer backend module entry point (T005).
 *
 * Provides registration, export, and binary detection for the ghostty
 * renderer backend.
 */

import type { RendererRegistry } from '../registry';
import { GhosttyBackend } from './backend';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { GhosttyBackend } from './backend';
export {
  GhosttyNotInitializedError,
  GhosttyNotRunningError,
  GhosttyAlreadyInitializedError,
} from './backend';
export { GhosttyProcess, GhosttyBinaryNotFoundError, GhosttyProcessError } from './process';
export type { GhosttyOptions } from './process';
export { GhosttySurface, SurfaceBindingError } from './surface';
export type { GpuRenderingMode, GpuSurfaceStatus, SurfaceEventHandler } from './surface';
export {
  detectCapabilities,
  getCachedCapabilities,
  clearCapabilityCache,
  detectGpu,
} from './capabilities';
export { GhosttyMetrics } from './metrics';
export type {
  FrameSample,
  InputLatencySample,
  MetricsSnapshot,
  MetricsConfig,
  MetricsPublisher,
} from './metrics';
export { GhosttyInputRelay, InputRelayError } from './input';
export type { PtyWriter, GhosttyInputEvent, InputEventListener } from './input';

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

/**
 * Check whether the ghostty binary is available on the system PATH.
 *
 * @param binaryPath - Override the binary name/path. Defaults to "ghostty".
 * @returns `true` if the binary is found.
 */
export async function isGhosttyAvailable(binaryPath = "ghostty"): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", binaryPath], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Detect the installed ghostty version string.
 *
 * @returns The version string, or "unknown" if detection fails.
 */
export async function detectGhosttyVersion(binaryPath = "ghostty"): Promise<string> {
  try {
    const proc = Bun.spawn([binaryPath, "--version"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : "unknown";
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Create a {@link GhosttyBackend} and register it with the given registry.
 *
 * If ghostty is not installed, logs a warning and returns without
 * registering (does **not** throw).
 *
 * @param registry - The renderer registry to register with.
 * @param binaryPath - Optional override for the ghostty binary path.
 */
export async function registerGhostty(
  registry: RendererRegistry,
  binaryPath?: string | undefined
): Promise<void> {
  const available = await isGhosttyAvailable(binaryPath);

  if (!available) {
    return;
  }

  const version = await detectGhosttyVersion(binaryPath);
  const backend = new GhosttyBackend(version);
  registry.register(backend);
}
