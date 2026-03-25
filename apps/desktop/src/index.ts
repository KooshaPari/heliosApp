import { healthCheck, VERSION, type HealthCheckResult } from "@helios/runtime";
import {
  ActiveContextStore,
  INITIAL_ACTIVE_CONTEXT_STATE,
  selectActiveContext
} from "./context_store";
import { DesktopRuntimeClient } from "./runtime_client";
import {
  DEFAULT_SETTINGS,
  type RendererEngine,
  switchRendererWithRollback,
  type SwitchRendererOutcome
} from "./settings";
import { buildAllTabSurfaces } from "./tabs";
import type { LocalBus } from "../../runtime/src/protocol/bus";

type BootDesktopInput = {
  bus: LocalBus;
};

type LaneResult = {
  ok: boolean;
  laneId: string | null;
  error: string | null;
};

type SessionResult = {
  ok: boolean;
  sessionId: string | null;
  error: string | null;
};

type TerminalResult = {
  ok: boolean;
  terminalId: string | null;
  error: string | null;
};

type RendererResult = SwitchRendererOutcome & {
  activeEngine: RendererEngine;
};

function escapeHtml(value: string | null): string {
  return (value ?? "none")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class EditorlessControlPlane {
  readonly store = new ActiveContextStore(INITIAL_ACTIVE_CONTEXT_STATE);
  private readonly runtimeClient: DesktopRuntimeClient;
  private settings = { ...DEFAULT_SETTINGS };

  constructor(input: BootDesktopInput) {
    this.runtimeClient = new DesktopRuntimeClient(input.bus);
  }

  setWorkspace(workspaceId: string): void {
    this.store.dispatch({ type: "workspace.set", workspaceId });
  }

  setActiveTab(tab: keyof ReturnType<typeof buildAllTabSurfaces>): void {
    this.store.dispatch({ type: "tab.set", tab });
  }

  getActiveContext() {
    return selectActiveContext(this.store.getState());
  }

  getTabs() {
    return buildAllTabSurfaces(this.store.getState());
  }

  async createLane(input: {
    workspaceId: string;
    preferredTransport?: string;
    simulateDegrade?: boolean;
    forceError?: boolean;
  }): Promise<LaneResult> {
    this.store.dispatch({ type: "workspace.set", workspaceId: input.workspaceId });
    this.store.dispatch({ type: "operation.start", operation: "lane" });
    const result = await this.runtimeClient.createLane(input);
    this.store.dispatch({ type: "diagnostics.set", diagnostics: result.diagnostics });

    if (!result.ok || result.id === null || result.runtimeState === null) {
      this.store.dispatch({
        type: "operation.failure",
        operation: "lane",
        error: result.error ?? "lane create failed"
      });
      return { ok: false, laneId: null, error: result.error };
    }

    this.store.dispatch({ type: "lane.set", laneId: result.id });
    this.store.dispatch({ type: "runtime.state.set", runtimeState: result.runtimeState });
    this.store.dispatch({ type: "operation.success", operation: "lane" });

    return { ok: true, laneId: result.id, error: null };
  }

  async ensureSession(input: {
    workspaceId: string;
    laneId: string;
    forceError?: boolean;
  }): Promise<SessionResult> {
    this.store.dispatch({ type: "workspace.set", workspaceId: input.workspaceId });
    this.store.dispatch({ type: "lane.set", laneId: input.laneId });
    this.store.dispatch({ type: "operation.start", operation: "session" });
    const result = await this.runtimeClient.ensureSession(input);
    this.store.dispatch({ type: "diagnostics.set", diagnostics: result.diagnostics });

    if (!result.ok || result.id === null || result.runtimeState === null) {
      this.store.dispatch({
        type: "operation.failure",
        operation: "session",
        error: result.error ?? "session attach failed"
      });
      return { ok: false, sessionId: null, error: result.error };
    }

    this.store.dispatch({ type: "session.set", sessionId: result.id });
    this.store.dispatch({ type: "runtime.state.set", runtimeState: result.runtimeState });
    this.store.dispatch({ type: "operation.success", operation: "session" });

    return { ok: true, sessionId: result.id, error: null };
  }

  async spawnTerminal(input: {
    workspaceId: string;
    laneId: string;
    sessionId: string;
    forceError?: boolean;
  }): Promise<TerminalResult> {
    this.store.dispatch({ type: "workspace.set", workspaceId: input.workspaceId });
    this.store.dispatch({ type: "lane.set", laneId: input.laneId });
    this.store.dispatch({ type: "session.set", sessionId: input.sessionId });
    this.store.dispatch({ type: "operation.start", operation: "terminal" });
    const result = await this.runtimeClient.spawnTerminal(input);
    this.store.dispatch({ type: "diagnostics.set", diagnostics: result.diagnostics });

    if (!result.ok || result.id === null || result.runtimeState === null) {
      this.store.dispatch({
        type: "operation.failure",
        operation: "terminal",
        error: result.error ?? "terminal spawn failed"
      });
      return { ok: false, terminalId: null, error: result.error };
    }

    this.store.dispatch({ type: "terminal.set", terminalId: result.id });
    this.store.dispatch({ type: "runtime.state.set", runtimeState: result.runtimeState });
    this.store.dispatch({ type: "operation.success", operation: "terminal" });

    return { ok: true, terminalId: result.id, error: null };
  }

  async switchRenderer(
    targetEngine: RendererEngine,
    options?: { forceError?: boolean; forceRollbackError?: boolean }
  ): Promise<RendererResult> {
    const outcome = await switchRendererWithRollback({
      settings: this.settings,
      targetEngine,
      runtimeClient: this.runtimeClient,
      contextStore: this.store,
      forceError: options?.forceError,
      forceRollbackError: options?.forceRollbackError
    });
    this.settings = outcome.settings;
    return {
      ...outcome,
      activeEngine: outcome.settings.rendererEngine
    };
  }
}

export function bootDesktop(input: BootDesktopInput): EditorlessControlPlane {
  return new EditorlessControlPlane(input);
}

export function renderControlPlaneSnapshot(controlPlane: EditorlessControlPlane): string {
  const tabs = controlPlane.getTabs();
  const renderer = controlPlane.store.getState().rendererSwitch;
  const rendererEngine = controlPlane.store.getState().rendererSwitch.targetEngine
    ?? DEFAULT_SETTINGS.rendererEngine;

  const tabMarkup = Object.entries(tabs)
    .map(([tab, surface]) => {
      const context = surface.context;
      return [
        `<section data-testid="tab-${tab}">`,
        `<div data-testid="tab-${tab}-workspace">${escapeHtml(context.workspaceId)}</div>`,
        `<div data-testid="tab-${tab}-lane">${escapeHtml(context.laneId)}</div>`,
        `<div data-testid="tab-${tab}-session">${escapeHtml(context.sessionId)}</div>`,
        `<div data-testid="tab-${tab}-terminal">${escapeHtml(context.terminalId)}</div>`,
        `<div data-testid="tab-${tab}-transport">${escapeHtml(surface.diagnostics.resolvedTransport)}</div>`,
        `<div data-testid="tab-${tab}-degrade">${escapeHtml(surface.diagnostics.degradedReason)}</div>`,
        `</section>`
      ].join("");
    })
    .join("");

  return [
    "<!doctype html>",
    "<html><body>",
    `<div data-testid="renderer-engine">${escapeHtml(rendererEngine)}</div>`,
    `<div data-testid="renderer-switch-status">${escapeHtml(renderer.lastStatus)}</div>`,
    tabMarkup,
    "</body></html>"
  ].join("");
}

function main(): void {
  const health: HealthCheckResult = healthCheck();

  console.log(`[helios-desktop] runtime v${VERSION}`);
  console.log(`[helios-desktop] health: ok=${String(health.ok)} uptime=${health.uptimeMs.toFixed(1)}ms`);
  console.log("[helios-desktop] monorepo workspace resolution: OK");
}

if (import.meta.main) {
  main();
}
