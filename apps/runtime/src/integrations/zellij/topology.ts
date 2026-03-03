/**
 * T010 - Layout topology tracking.
 *
 * Maintains a queryable model of the current session layout
 * including tabs, panes, dimensions, focus state, and PTY bindings.
 */

import type { ZellijCli } from "./cli.js";
import type { LayoutTopology, PaneDimensions, PaneTopology, TabTopology } from "./types.js";

/**
 * Manages layout topology for all tracked sessions.
 */
export class TopologyTracker {
  private readonly topologies = new Map<string, LayoutTopology>();
  private readonly cli: ZellijCli;

  constructor(cli: ZellijCli) {
    this.cli = cli;
  }

  /**
   * Get the cached topology for a session.
   */
  getTopology(sessionName: string): LayoutTopology | undefined {
    return this.topologies.get(sessionName);
  }

  /**
   * Initialize topology for a new session with a single default tab and pane.
   */
  initializeTopology(
    sessionName: string,
    initialDimensions: PaneDimensions = { cols: 80, rows: 24 }
  ): LayoutTopology {
    const topology: LayoutTopology = {
      sessionName,
      tabs: [
        {
          tabId: 0,
          name: "Tab #1",
          panes: [
            {
              paneId: 0,
              dimensions: { ...initialDimensions },
              focused: true,
            },
          ],
          layout: "horizontal",
        },
      ],
      activeTabId: 0,
    };
    this.topologies.set(sessionName, topology);
    return topology;
  }

  /**
   * Add a pane to the active tab's topology.
   */
  addPane(sessionName: string, paneId: number, dimensions: PaneDimensions, ptyId?: string): void {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return;
    }

    const activeTab = topology.tabs.find(t => t.tabId === topology.activeTabId);
    if (!activeTab) {
      return;
    }

    // Unfocus all existing panes
    for (const p of activeTab.panes) {
      p.focused = false;
    }

    activeTab.panes.push({
      paneId,
      ptyId,
      dimensions: { ...dimensions },
      focused: true,
    });
  }

  /**
   * Remove a pane from the topology.
   */
  removePane(sessionName: string, paneId: number): void {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return;
    }

    for (const tab of topology.tabs) {
      const idx = tab.panes.findIndex(p => p.paneId === paneId);
      if (idx !== -1) {
        const wasFocused = tab.panes[idx]?.focused;
        tab.panes.splice(idx, 1);
        // If removed pane was focused, focus the first remaining pane
        if (wasFocused && tab.panes.length > 0) {
          const firstPane = tab.panes[0];
          if (firstPane) {
            firstPane.focused = true;
          }
        }
        return;
      }
    }
  }

  /**
   * Update pane dimensions in the topology.
   */
  updatePaneDimensions(sessionName: string, paneId: number, dimensions: PaneDimensions): void {
    const pane = this.findPane(sessionName, paneId);
    if (pane) {
      pane.dimensions = { ...dimensions };
    }
  }

  /**
   * Bind a PTY ID to a pane in the topology.
   */
  bindPty(sessionName: string, paneId: number, ptyId: string): void {
    const pane = this.findPane(sessionName, paneId);
    if (pane) {
      pane.ptyId = ptyId;
    }
  }

  /**
   * Add a tab to the topology.
   */
  addTab(
    sessionName: string,
    tabId: number,
    name: string,
    defaultPaneDimensions: PaneDimensions = { cols: 80, rows: 24 }
  ): void {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return;
    }

    topology.tabs.push({
      tabId,
      name,
      panes: [
        {
          paneId: tabId * 1000, // Convention: first pane ID derived from tab
          dimensions: { ...defaultPaneDimensions },
          focused: true,
        },
      ],
      layout: "horizontal",
    });
    topology.activeTabId = tabId;
  }

  /**
   * Remove a tab from the topology.
   */
  removeTab(sessionName: string, tabId: number): void {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return;
    }

    const idx = topology.tabs.findIndex(t => t.tabId === tabId);
    if (idx !== -1) {
      topology.tabs.splice(idx, 1);
      // Update active tab if needed
      if (topology.activeTabId === tabId && topology.tabs.length > 0) {
        topology.activeTabId = topology.tabs[0]?.tabId;
      }
    }
  }

  /**
   * Switch the active tab.
   */
  switchTab(sessionName: string, tabId: number): void {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return;
    }
    topology.activeTabId = tabId;
  }

  /**
   * Refresh topology by querying zellij directly.
   * Rebuilds the topology from scratch based on zellij's current state.
   */
  async refreshTopology(sessionName: string): Promise<LayoutTopology> {
    const result = await this.cli.run(["--session", sessionName, "action", "dump-layout"]);
    const existingTopology = this.topologies.get(sessionName);
    const ptyBindings = this.collectPtyBindings(existingTopology);

    const topology =
      result.exitCode === 0 && result.stdout.trim()
        ? this.parseLayoutDump(sessionName, result.stdout)
        : this.getFallbackTopology(sessionName);

    this.rebindTopologyPtys(topology, ptyBindings);
    this.topologies.set(sessionName, topology);
    return topology;
  }

  /**
   * Remove all topology data for a session.
   */
  removeSession(sessionName: string): void {
    this.topologies.delete(sessionName);
  }

  /**
   * Find a pane across all tabs in a session.
   */
  findPane(sessionName: string, paneId: number): PaneTopology | undefined {
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return undefined;
    }

    for (const tab of topology.tabs) {
      const pane = tab.panes.find(p => p.paneId === paneId);
      if (pane) {
        return pane;
      }
    }
    return undefined;
  }

  /**
   * Get all pane IDs with PTY bindings for a session.
   */
  getPtyBindings(sessionName: string): Map<number, string> {
    const bindings = new Map<number, string>();
    const topology = this.topologies.get(sessionName);
    if (!topology) {
      return bindings;
    }

    for (const tab of topology.tabs) {
      for (const pane of tab.panes) {
        if (pane.ptyId) {
          bindings.set(pane.paneId, pane.ptyId);
        }
      }
    }
    return bindings;
  }

  /**
   * Parse zellij dump-layout output into a LayoutTopology.
   * Zellij dump-layout returns KDL format; we do a best-effort parse.
   */
  private parseLayoutDump(sessionName: string, output: string): LayoutTopology {
    const lines = output.split("\n");

    const parseState = {
      tabs: [] as TabTopology[],
      activeTabId: 0,
      currentTabId: 0,
      currentTabName: "Tab #1",
      panes: [] as PaneTopology[],
      paneCounter: 0,
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const updatedTab = this.parseTabStart(trimmed);
      if (updatedTab) {
        this.appendCurrentTab(parseState);
        parseState.currentTabId = parseState.tabs.length;
        parseState.currentTabName = updatedTab.name;
        parseState.activeTabId = updatedTab.isActive
          ? parseState.currentTabId
          : parseState.activeTabId;
        parseState.panes = [];
        continue;
      }

      const paneMatch = this.parsePane(trimmed, parseState.paneCounter);
      if (paneMatch) {
        parseState.panes.push(paneMatch.pane);
        parseState.paneCounter += 1;
      }
    }

    this.appendCurrentTab(parseState);

    if (parseState.tabs.length === 0) {
      return this.getFallbackTopology(sessionName);
    }

    return { sessionName, tabs: parseState.tabs, activeTabId: parseState.activeTabId };
  }

  private parseTabStart(trimmed: string): { name: string; isActive: boolean } | null {
    const tabMatch = trimmed.match(/tab\s+name="([^"]*)"(?:\s+focus=true)?/);
    if (!tabMatch) {
      return null;
    }
    const [, name = "Tab #1"] = tabMatch;
    return {
      name,
      isActive: trimmed.includes("focus=true"),
    };
  }

  private parsePane(trimmed: string, paneCounter: number): { pane: PaneTopology } | null {
    if (!trimmed.startsWith("pane")) {
      return null;
    }

    const colsMatch = trimmed.match(/size_cols\s*=?\s*(\d+)/);
    const rowsMatch = trimmed.match(/size_rows\s*=?\s*(\d+)/);
    const focusMatch = trimmed.includes("focus=true");

    return {
      pane: {
        paneId: paneCounter,
        dimensions: {
          cols: this.parseDimension(colsMatch),
          rows: this.parseDimension(rowsMatch),
        },
        focused: focusMatch,
      },
    };
  }

  private parseDimension(match: RegExpMatchArray | null): number {
    if (!match?.[1]) {
      return 80;
    }
    return Number.parseInt(match[1], 10);
  }

  private getFallbackTopology(sessionName: string): LayoutTopology {
    return {
      sessionName,
      tabs: [
        {
          tabId: 0,
          name: "Tab #1",
          panes: [{ paneId: 0, dimensions: { cols: 80, rows: 24 }, focused: true }],
          layout: "horizontal",
        },
      ],
      activeTabId: 0,
    };
  }

  private collectPtyBindings(topology?: LayoutTopology): Map<number, string> {
    const ptyBindings = new Map<number, string>();
    if (!topology) {
      return ptyBindings;
    }

    for (const tab of topology.tabs) {
      for (const pane of tab.panes) {
        if (pane.ptyId) {
          ptyBindings.set(pane.paneId, pane.ptyId);
        }
      }
    }

    return ptyBindings;
  }

  private rebindTopologyPtys(topology: LayoutTopology, ptyBindings: Map<number, string>): void {
    for (const tab of topology.tabs) {
      for (const pane of tab.panes) {
        const ptyId = ptyBindings.get(pane.paneId);
        if (ptyId) {
          pane.ptyId = ptyId;
        }
      }
    }
  }

  private appendCurrentTab(parseState: {
    tabs: TabTopology[];
    currentTabName: string;
    currentTabId: number;
    panes: PaneTopology[];
  }): void {
    if (parseState.panes.length === 0) {
      return;
    }

    parseState.tabs.push({
      tabId: parseState.currentTabId,
      name: parseState.currentTabName,
      panes: [...parseState.panes],
      layout: "horizontal",
    });
  }
}
