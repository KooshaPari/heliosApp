/**
 * @helios/desktop — Desktop shell entry point for heliosApp.
 *
 * Creates the ElectroBun window and initializes the terminal surface.
 * Cross-workspace import from @helios/runtime validates path alias resolution.
 */

import { healthCheck, VERSION } from "@helios/runtime";
import type { HealthCheckResult } from "@helios/runtime";
import type { LocalBus } from "../../runtime/src/protocol/bus";
import { DesktopRuntimeClient, type LifecycleResult, type RendererSwitchResult } from "./runtime_client";

function main(): void {
  const health: HealthCheckResult = healthCheck();

  console.log(`[helios-desktop] runtime v${VERSION}`);
  console.log(
    `[helios-desktop] health: ok=${String(health.ok)} uptime=${health.uptimeMs.toFixed(1)}ms`,
  );

  // ElectroBun window creation will be wired in spec 001 WP00.
  // For now, confirm the monorepo cross-workspace import works.
  console.log("[helios-desktop] monorepo workspace resolution: OK");
}

main();

/**
 * Control plane interface for the desktop shell.
 * Wraps DesktopRuntimeClient with workspace/tab state management.
 */
/** Tab context snapshot for getTabs(). */
export interface TabContextSnapshot {
  context: { workspaceId: string; laneId: string; sessionId: string; terminalId?: string };
  diagnostics: { resolvedTransport: string; degradedReason: string | null };
}

/** Renderer switch result. */
export interface RendererSwitchOutcome {
  committed: boolean;
  rolledBack: boolean;
  activeEngine: string;
}

/** Control plane store state. */
export interface ControlPlaneState {
  rendererSwitch: { lastStatus: string };
}

export interface ControlPlane {
  createLane(input: { workspaceId: string; simulateDegrade?: boolean; forceError?: boolean }): Promise<LifecycleResult & { laneId: string | null }>;
  ensureSession(input: { workspaceId: string; laneId: string; forceError?: boolean }): Promise<LifecycleResult & { sessionId: string | null }>;
  spawnTerminal(input: { workspaceId: string; laneId: string; sessionId: string; forceError?: boolean }): Promise<LifecycleResult & { terminalId: string | null }>;
  setActiveTab(tab: string): void;
  setWorkspace(workspaceId: string): void;
  switchRenderer(engine: string, opts?: { forceError?: boolean }): Promise<RendererSwitchOutcome>;
  getTabs(): Record<string, TabContextSnapshot>;
  getActiveContext(): { workspaceId: string; laneId: string; sessionId: string } | null;
  store: { getState(): ControlPlaneState };
}

/** Boot the desktop control plane with the given bus. */
export function bootDesktop(config: { bus: LocalBus }): ControlPlane {
  const client = new DesktopRuntimeClient(config.bus);
  let currentWorkspace = "";
  let currentLaneId = "";
  let currentSessionId = "";
  let currentTerminalId = "";
  let currentEngine = "ghostty";
  let lastSwitchStatus = "";

  const activeContext = () => ({
    workspaceId: currentWorkspace,
    laneId: currentLaneId,
    sessionId: currentSessionId,
  });

  return {
    async createLane(input) {
      const result = await client.createLane(input);
      if (result.id) currentLaneId = result.id;
      return { ...result, laneId: result.id };
    },
    async ensureSession(input) {
      const result = await client.ensureSession(input);
      if (result.id) currentSessionId = result.id;
      return { ...result, sessionId: result.id };
    },
    async spawnTerminal(input) {
      const result = await client.spawnTerminal(input);
      if (result.id) currentTerminalId = result.id;
      return { ...result, terminalId: result.id };
    },
    setActiveTab(_tab: string) {
      // Tab switching state management (stub)
    },
    setWorkspace(workspaceId: string) {
      currentWorkspace = workspaceId;
    },
    async switchRenderer(engine, opts) {
      const result = await client.switchRenderer({
        workspaceId: currentWorkspace,
        targetEngine: engine as "ghostty" | "rio",
        forceError: opts?.forceError,
      });
      if (result.ok) {
        currentEngine = result.activeEngine;
        lastSwitchStatus = "committed";
      } else {
        lastSwitchStatus = "rolled_back";
      }
      return {
        committed: result.ok,
        rolledBack: !result.ok,
        activeEngine: result.ok ? result.activeEngine : currentEngine,
      };
    },
    getTabs() {
      const ctx: TabContextSnapshot = {
        context: { workspaceId: currentWorkspace, laneId: currentLaneId, sessionId: currentSessionId, terminalId: currentTerminalId },
        diagnostics: { resolvedTransport: "cliproxy_harness", degradedReason: null },
      };
      return { terminal: ctx, agent: ctx, session: ctx, chat: ctx, project: ctx };
    },
    getActiveContext() {
      return currentWorkspace ? activeContext() : null;
    },
    store: {
      getState() {
        return { rendererSwitch: { lastStatus: lastSwitchStatus } };
      },
    },
  };
}

/** Render a snapshot of the control plane state as HTML (for e2e tests). */
export function renderControlPlaneSnapshot(_controlPlane: ControlPlane): string {
  return "<div>Control plane snapshot (stub)</div>";
}
