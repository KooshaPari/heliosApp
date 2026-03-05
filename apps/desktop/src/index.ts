/**
 * @helios/desktop — Desktop shell entry point for heliosApp.
 *
 * Creates the ElectroBun window and initializes the terminal surface.
 * Cross-workspace import from @helios/runtime validates path alias resolution.
 */

import { healthCheck, VERSION, type HealthCheckResult } from "@helios/runtime";

function main(): void {
  const health: HealthCheckResult = healthCheck();

  console.log(`[helios-desktop] runtime v${VERSION}`);
  console.log(`[helios-desktop] health: ok=${String(health.ok)} uptime=${health.uptimeMs.toFixed(1)}ms`);

  // ElectroBun window creation will be wired in spec 001 WP00.
  // For now, confirm the monorepo cross-workspace import works.
  console.log("[helios-desktop] monorepo workspace resolution: OK");
}

main();
