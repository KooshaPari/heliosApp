/**
 * T002/T003/T004 - Session create, reattach, and terminate operations.
 *
 * Manages the lifecycle of zellij sessions bound to lanes.
 */

import type { ZellijCli } from "./cli.js";
import type { MuxRegistry } from "./registry.js";
import type { TopologyTracker } from "./topology.js";
import type { MuxEventEmitter } from "./events.js";
import { MuxEventType } from "./events.js";
import type {
  MuxSession,
  SessionOptions,
  PaneRecord,
  TabRecord,
  PtyManagerInterface,
} from "./types.js";
import {
  SessionNotFoundError,
  SessionAlreadyExistsError,
  ZellijCliError,
} from "./errors.js";

/**
 * Generate the canonical session name for a lane.
 */
export function sessionNameForLane(laneId: string): string {
  return `helios-lane-${laneId}`;
}

export class ZellijSessionManager {
  private readonly cli: ZellijCli;
  private readonly registry: MuxRegistry;
  private readonly topology: TopologyTracker | undefined;
  private readonly ptyManager: PtyManagerInterface | undefined;
  private readonly emitter: MuxEventEmitter | undefined;

  constructor(
    cli: ZellijCli,
    registry: MuxRegistry,
    options?: {
      topology?: TopologyTracker;
      ptyManager?: PtyManagerInterface;
      emitter?: MuxEventEmitter;
    },
  ) {
    this.cli = cli;
    this.registry = registry;
    this.topology = options?.topology;
    this.ptyManager = options?.ptyManager;
    this.emitter = options?.emitter;
  }

  /**
   * T002 - Create a new zellij session bound to a lane.
   */
  async createSession(
    laneId: string,
    options?: SessionOptions
  ): Promise<MuxSession> {
    const sessionName = sessionNameForLane(laneId);
    const startMs = performance.now();

    // Check if session already exists
    const existing = await this.cli.listSessions();
    if (existing.some((s) => s.name === sessionName)) {
      throw new SessionAlreadyExistsError(sessionName);
    }

    // Build create command args
    const args: string[] = ["--session", sessionName];

    // Create a detached session: use `zellij --session <name> action new-pane`
    // Alternative: `zellij attach --create <name>` in detached mode
    // We'll use: zellij setup and attach --create to create a named session
    const createArgs: string[] = ["attach", sessionName, "--create"];
    if (options?.cwd) {
      // There's no direct --cwd for attach, but we can set it via env
    }

    // For creating a detached session, we run the zellij process but let it detach
    // The typical approach is to use `zellij --session <name> action new-pane` after creation,
    // but first we need the session to exist. We use `zellij attach --create --force-run-client`
    // and then detach from it. Alternatively, zellij list-sessions tells us what exists.
    //
    // Simplest reliable approach: spawn `zellij attach <name> --create` backgrounded,
    // then immediately detach.
    const result = await this.cli.run(
      ["attach", sessionName, "--create", "--force-run-client"],
      { timeout: 10_000 }
    );

    // If the command exited (it normally would in non-interactive mode), check for errors
    if (result.exitCode !== 0 && !result.stdout.includes(sessionName)) {
      throw new ZellijCliError(
        `attach ${sessionName} --create`,
        result.exitCode,
        result.stderr
      );
    }

    // Verify session was created
    const postSessions = await this.cli.listSessions();
    const created = postSessions.find((s) => s.name === sessionName);

    const durationMs = performance.now() - startMs;
    console.debug(
      `[zellij-session] createSession(${laneId}) completed in ${durationMs.toFixed(1)}ms`
    );

    const muxSession: MuxSession = {
      sessionName,
      laneId,
      createdAt: created?.created ?? new Date(),
      panes: [],
      tabs: [],
    };

    // Register in binding registry
    this.registry.bind(sessionName, laneId, muxSession);

    return muxSession;
  }

  /**
   * T003 / T012 - Reattach to an existing zellij session.
   *
   * When a TopologyTracker is available, recovers pane topology from
   * zellij dump-layout, rebuilds tracker state, and re-binds PTYs.
   * Emits mux.session.reattached when an emitter is configured.
   */
  async reattachSession(sessionName: string): Promise<MuxSession> {
    const startMs = performance.now();

    // Verify the session exists
    const sessions = await this.cli.listSessions();
    const target = sessions.find((s) => s.name === sessionName);

    if (!target) {
      throw new SessionNotFoundError(sessionName);
    }

    const laneId = this.extractLaneId(sessionName);

    let panes: PaneRecord[];
    let tabs: TabRecord[];

    // T012: If topology tracker is available, use dump-layout for full recovery
    if (this.topology) {
      const layout = await this.topology.refreshTopology(sessionName);

      // Rebuild PaneRecord[] and TabRecord[] from the recovered topology
      panes = [];
      tabs = [];

      for (const tabTopo of layout.tabs) {
        const tabPanes: PaneRecord[] = [];
        for (const paneTopo of tabTopo.panes) {
          const record: PaneRecord = {
            id: paneTopo.paneId,
            title: `pane-${paneTopo.paneId}`,
            dimensions: { ...paneTopo.dimensions },
            ptyId: paneTopo.ptyId,
          };
          panes.push(record);
          tabPanes.push(record);

          // Re-bind PTY if ptyManager is available and pane has no pty yet
          if (this.ptyManager && !paneTopo.ptyId) {
            try {
              const ptyResult = await this.ptyManager.spawn({
                laneId,
                sessionId: sessionName,
                terminalId: String(paneTopo.paneId),
                cols: paneTopo.dimensions.cols,
                rows: paneTopo.dimensions.rows,
              });
              this.topology.bindPty(sessionName, paneTopo.paneId, ptyResult.ptyId);
              record.ptyId = ptyResult.ptyId;
            } catch (err) {
              console.warn(
                `[zellij-session] PTY re-bind failed for pane ${paneTopo.paneId}:`,
                err,
              );
            }
          }
        }

        tabs.push({
          index: tabTopo.tabId,
          name: tabTopo.name,
          panes: tabPanes,
        });
      }
    } else {
      // Fallback: basic query without topology tracker
      panes = await this.queryPanes(sessionName);
      tabs = await this.queryTabs(sessionName);
    }

    const durationMs = performance.now() - startMs;
    console.debug(
      `[zellij-session] reattachSession(${sessionName}) completed in ${durationMs.toFixed(1)}ms`,
    );

    const muxSession: MuxSession = {
      sessionName,
      laneId,
      createdAt: target.created,
      panes,
      tabs,
    };

    // Re-register in the binding registry (unbind first in case stale binding exists)
    this.registry.unbind(sessionName);
    this.registry.bind(sessionName, laneId, muxSession);

    // T012: Emit reattach event
    if (this.emitter) {
      this.emitter.emitTyped({
        type: MuxEventType.SESSION_REATTACHED,
        sessionName,
        laneId,
        recoveredPaneCount: panes.length,
        recoveredTabCount: tabs.length,
      });
    }

    return muxSession;
  }

  /**
   * T004 - Terminate a zellij session and clean up.
   */
  async terminateSession(sessionName: string): Promise<void> {
    // Kill the session
    const result = await this.cli.run(["kill-session", sessionName]);

    // If session doesn't exist, that's fine (idempotent)
    if (
      result.exitCode !== 0 &&
      !result.stderr.includes("not found") &&
      !result.stderr.includes("No session")
    ) {
      // Retry once after a delay
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const retry = await this.cli.run(["kill-session", sessionName]);
      if (
        retry.exitCode !== 0 &&
        !retry.stderr.includes("not found") &&
        !retry.stderr.includes("No session")
      ) {
        console.error(
          `[zellij-session] Failed to kill session ${sessionName}: ${retry.stderr}`
        );
      }
    }

    // Verify session is gone
    const sessions = await this.cli.listSessions();
    if (sessions.some((s) => s.name === sessionName)) {
      console.warn(
        `[zellij-session] Session ${sessionName} still exists after kill attempt`
      );
    }

    // Remove from binding registry regardless
    this.registry.unbind(sessionName);

    // Publish terminated event (log-based for now; bus integration in later WPs)
    console.debug(
      `[zellij-session] mux.session.terminated: ${sessionName}`
    );
  }

  /**
   * Query pane topology of a session.
   */
  private async queryPanes(sessionName: string): Promise<PaneRecord[]> {
    try {
      const result = await this.cli.run([
        "--session",
        sessionName,
        "action",
        "dump-layout",
      ]);
      if (result.exitCode !== 0) {
        console.warn(
          `[zellij-session] Could not query panes for ${sessionName}: ${result.stderr}`
        );
        return [];
      }
      // Basic pane extraction - in practice zellij dump-layout returns KDL
      // For now return a single default pane
      return [{ id: 0, title: "default" }];
    } catch {
      return [];
    }
  }

  /**
   * Query tab topology of a session.
   */
  private async queryTabs(sessionName: string): Promise<TabRecord[]> {
    try {
      const result = await this.cli.run([
        "--session",
        sessionName,
        "action",
        "dump-layout",
      ]);
      if (result.exitCode !== 0) {
        return [];
      }
      // Basic tab extraction
      return [{ index: 0, name: "Tab #1", panes: [{ id: 0, title: "default" }] }];
    } catch {
      return [];
    }
  }

  /**
   * Extract lane ID from the session naming convention.
   */
  private extractLaneId(sessionName: string): string {
    const prefix = "helios-lane-";
    if (sessionName.startsWith(prefix)) {
      return sessionName.slice(prefix.length);
    }
    return sessionName;
  }
}
