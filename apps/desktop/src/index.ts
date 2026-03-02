/**
 * @helios/desktop — Desktop shell entry point for heliosApp.
 *
 * Creates the ElectroBun window and initializes the terminal surface.
 * Cross-workspace import from @helios/runtime validates path alias resolution.
 */

import { type HealthCheckResult, healthCheck } from "@helios/runtime";

function main(): void {
  const _health: HealthCheckResult = healthCheck();
}

main();

// Stubs: bootDesktop and renderControlPlaneSnapshot — full implementation pending spec 001 WP05
// Stub returns any — pending full implementation
export function bootDesktop(_opts: { bus: unknown }): any {
  return {};
}

export function renderControlPlaneSnapshot(_state: unknown): string {
  return "";
}
