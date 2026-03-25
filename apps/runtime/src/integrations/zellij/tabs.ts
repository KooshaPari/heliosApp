/**
 * T007 - Tab create, close, and switch operations.
 *
 * Organizes panes into tabs within zellij sessions
 * for context separation (FR-009-004).
 */

import type { ZellijCli } from "./cli.js";
import type { TopologyTracker } from "./topology.js";
import type { ZellijPaneManager } from "./panes.js";
import type { TabRecord, PtyManagerInterface } from "./types.js";
import { ZellijCliError } from "./errors.js";
import { isIgnorableMissingTabError, runTabCommand } from "./tabs/commands.js";
import { requireTabTopology, terminateTabPtys } from "./tabs/validation.js";

/**
 * Manages tab lifecycle within zellij sessions.
 */
export class ZellijTabManager {
  private readonly cli: ZellijCli;
  private readonly topology: TopologyTracker;
  private readonly paneManager: ZellijPaneManager;
  private readonly ptyManager: PtyManagerInterface | undefined;
  private tabCounter = 0;

  constructor(options: {
    cli: ZellijCli;
    topology: TopologyTracker;
    paneManager: ZellijPaneManager;
    ptyManager?: PtyManagerInterface;
  }) {
    this.cli = options.cli;
    this.topology = options.topology;
    this.paneManager = options.paneManager;
    this.ptyManager = options.ptyManager;
  }

  /**
   * Create a new tab in a session.
   */
  async createTab(
    sessionName: string,
    name?: string,
  ): Promise<TabRecord> {
    const startMs = performance.now();
    const tabId = ++this.tabCounter;
    const tabName = name ?? `Tab #${tabId}`;

    const args = ["--session", sessionName, "action", "new-tab"];
    if (name) {
      args.push("--name", name);
    }

    await runTabCommand(this.cli, `new-tab --session ${sessionName}`, args);

    // Update topology
    this.topology.addTab(sessionName, tabId, tabName);

    const record: TabRecord = {
      index: tabId,
      name: tabName,
      panes: [{ id: tabId * 1000, title: "default" }],
      createdAt: new Date(),
    };

    const durationMs = performance.now() - startMs;
    console.debug(
      `[zellij-tabs] createTab(${sessionName}) tab=${tabId} name="${tabName}" duration=${durationMs.toFixed(1)}ms`,
    );
    console.debug(
      `[zellij-tabs] mux.tab.created: session=${sessionName} tab=${tabId}`,
    );

    return record;
  }

  /**
   * Close a tab and all its panes' PTYs.
   */
  async closeTab(sessionName: string, tabId: number): Promise<void> {
    const { tab } = requireTabTopology(this.topology, sessionName, tabId);
    await terminateTabPtys(this.ptyManager, tab, tabId);

    // Close the tab via zellij CLI
    // Switch to the tab first, then close it
    const switchResult = await this.cli.run([
      "--session",
      sessionName,
      "action",
      "go-to-tab",
      "--tab-position",
      String(tabId),
    ]);

    // Ignore switch errors if tab is already active
    if (switchResult.exitCode !== 0) {
      console.warn(
        `[zellij-tabs] Could not switch to tab ${tabId} before close: ${switchResult.stderr}`,
      );
    }

    const result = await this.cli.run([
      "--session",
      sessionName,
      "action",
      "close-tab",
    ]);

    if (result.exitCode !== 0) {
      // If tab doesn't exist, treat as success (idempotent)
      if (!isIgnorableMissingTabError(result.stderr)) {
        throw new ZellijCliError(
          `close-tab --session ${sessionName}`,
          result.exitCode,
          result.stderr,
        );
      }
    }

    // Update topology
    this.topology.removeTab(sessionName, tabId);

    console.debug(
      `[zellij-tabs] mux.tab.closed: session=${sessionName} tab=${tabId}`,
    );
  }

  /**
   * Switch to a tab in a session.
   */
  async switchTab(sessionName: string, tabId: number): Promise<void> {
    requireTabTopology(this.topology, sessionName, tabId);

    await runTabCommand(
      this.cli,
      `go-to-tab --session ${sessionName} --tab-position ${tabId}`,
      [
        "--session",
        sessionName,
        "action",
        "go-to-tab",
        "--tab-position",
        String(tabId),
      ],
    );

    // Update topology
    this.topology.switchTab(sessionName, tabId);

    console.debug(
      `[zellij-tabs] mux.tab.switched: session=${sessionName} tab=${tabId}`,
    );
  }

  /**
   * Get the active tab ID for a session.
   */
  getActiveTab(sessionName: string): number | undefined {
    const topology = this.topology.getTopology(sessionName);
    return topology?.activeTabId;
  }
}
