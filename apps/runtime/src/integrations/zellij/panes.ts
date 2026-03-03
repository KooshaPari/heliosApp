/**
 * T006 - Pane create, close, and resize operations.
 * T008 - PTY lifecycle integration for pane operations.
 * T009 - Minimum pane dimension enforcement.
 *
 * Manages terminal panes within zellij sessions, with PTY lifecycle
 * integration (spec 007) and dimension enforcement (FR-009-007).
 */

import type { ZellijCli } from "./cli.js";
import { PaneTooSmallError, PtyBindingError, ZellijCliError } from "./errors.js";
import type { TopologyTracker } from "./topology.js";
import type {
  CreatePaneOptions,
  MinPaneDimensions,
  PaneDimensions,
  PaneRecord,
  PtyManagerInterface,
} from "./types.js";

/** Default minimum pane dimensions. */
const DEFAULT_MIN_DIMENSIONS: MinPaneDimensions = {
  minCols: 10,
  minRows: 3,
};

/**
 * Manages pane lifecycle within zellij sessions.
 */
export class ZellijPaneManager {
  private readonly cli: ZellijCli;
  private readonly topology: TopologyTracker;
  private readonly ptyManager: PtyManagerInterface | undefined;
  private readonly minDimensions: MinPaneDimensions;
  private paneCounter = 0;

  constructor(options: {
    cli: ZellijCli;
    topology: TopologyTracker;
    ptyManager?: PtyManagerInterface;
    minDimensions?: MinPaneDimensions;
  }) {
    this.cli = options.cli;
    this.topology = options.topology;
    this.ptyManager = options.ptyManager;
    this.minDimensions = options.minDimensions ?? { ...DEFAULT_MIN_DIMENSIONS };
  }

  /**
   * T006 - Create a new pane in a session.
   * T008 - Spawns a PTY for the new pane.
   * T009 - Validates minimum dimensions before split.
   */
  async createPane(
    sessionName: string,
    laneId: string,
    options?: CreatePaneOptions
  ): Promise<PaneRecord> {
    const startMs = performance.now();
    const direction = options?.direction ?? "vertical";

    this.validateSplitForNewPane(sessionName, direction);

    // T006: Execute zellij pane creation
    const args = ["--session", sessionName, "action", "new-pane"];
    if (direction === "horizontal") {
      args.push("--direction", "down");
    } else {
      args.push("--direction", "right");
    }
    if (options?.cwd) {
      args.push("--cwd", options.cwd);
    }

    const result = await this.cli.run(args);
    if (result.exitCode !== 0) {
      throw new ZellijCliError(`new-pane --session ${sessionName}`, result.exitCode, result.stderr);
    }

    const paneId = ++this.paneCounter;

    // Query dimensions after creation (refresh topology)
    const refreshed = await this.topology.refreshTopology(sessionName);
    const activeTab = refreshed.tabs.find(t => t.tabId === refreshed.activeTabId);
    const newPaneTopology = activeTab?.panes[activeTab.panes.length - 1];
    const dimensions: PaneDimensions = newPaneTopology?.dimensions ?? {
      cols: 80,
      rows: 24,
    };

    // Update topology with the new pane
    this.topology.addPane(sessionName, paneId, dimensions);

    // T008: Spawn PTY for the pane
    const ptyId = await this.spawnPanePty(sessionName, laneId, paneId, dimensions, options?.cwd);

    const record: PaneRecord = {
      id: paneId,
      title: `pane-${paneId}`,
      dimensions,
      ptyId,
      createdAt: new Date(),
    };

    const _durationMs = performance.now() - startMs;

    return record;
  }

  /**
   * T006 - Close a pane in a session.
   * T008 - Terminates the PTY before closing the pane.
   */
  async closePane(sessionName: string, paneId: number): Promise<void> {
    // T008: Terminate PTY first if bound
    if (this.ptyManager) {
      const paneTopology = this.topology.findPane(sessionName, paneId);
      if (paneTopology?.ptyId) {
        try {
          await this.ptyManager.terminate(paneTopology.ptyId);
        } catch (_err) {
          // PTY already terminated or not bound yet; closePane remains idempotent.
        }
      }
    }

    await this.closePaneRaw(sessionName, paneId);

    // Remove from topology
    this.topology.removePane(sessionName, paneId);
  }

  /**
   * T006 - Resize a pane.
   * T008 - Relay dimensions to PTY.
   * T009 - Validate minimum dimensions.
   */
  async resizePane(
    sessionName: string,
    paneId: number,
    direction: "left" | "right" | "up" | "down",
    amount: number
  ): Promise<void> {
    const startMs = performance.now();

    // T009: Pre-validate that resulting dimensions won't violate minimums
    const paneTopology = this.topology.findPane(sessionName, paneId);
    if (paneTopology) {
      const resultingDimensions = this.calculateResizedDimensions(
        paneTopology.dimensions,
        direction,
        amount
      );
      this.validateDimensions(resultingDimensions);
    }

    const result = await this.cli.run([
      "--session",
      sessionName,
      "action",
      "resize",
      direction,
      String(amount),
    ]);

    if (result.exitCode !== 0) {
      throw new ZellijCliError(`resize --session ${sessionName}`, result.exitCode, result.stderr);
    }

    // Refresh topology to get actual dimensions after resize
    await this.topology.refreshTopology(sessionName);

    // T008: Relay new dimensions to PTY
    if (this.ptyManager) {
      const updatedPane = this.topology.findPane(sessionName, paneId);
      if (updatedPane?.ptyId) {
        this.ptyManager.resize(
          updatedPane.ptyId,
          updatedPane.dimensions.cols,
          updatedPane.dimensions.rows
        );
      }
    }

    const _durationMs = performance.now() - startMs;
  }

  /**
   * T009 - Validate that a split would produce panes above minimum dimensions.
   */
  validateSplit(parentDimensions: PaneDimensions, direction: "horizontal" | "vertical"): void {
    const { minCols, minRows } = this.minDimensions;

    if (direction === "vertical") {
      // Vertical split divides columns
      const halfCols = Math.floor(parentDimensions.cols / 2);
      if (halfCols < minCols) {
        throw new PaneTooSmallError(halfCols, parentDimensions.rows, minCols, minRows);
      }
    } else {
      // Horizontal split divides rows
      const halfRows = Math.floor(parentDimensions.rows / 2);
      if (halfRows < minRows) {
        throw new PaneTooSmallError(parentDimensions.cols, halfRows, minCols, minRows);
      }
    }
  }

  /**
   * T009 - Validate that dimensions meet minimum requirements.
   */
  validateDimensions(dimensions: PaneDimensions): void {
    const { minCols, minRows } = this.minDimensions;
    if (dimensions.cols < minCols || dimensions.rows < minRows) {
      throw new PaneTooSmallError(dimensions.cols, dimensions.rows, minCols, minRows);
    }
  }

  /**
   * Get the current minimum dimension configuration.
   */
  getMinDimensions(): MinPaneDimensions {
    return { ...this.minDimensions };
  }

  /**
   * Close a pane via zellij CLI without PTY cleanup or topology update.
   */
  private async closePaneRaw(sessionName: string, _paneId: number): Promise<void> {
    const result = await this.cli.run(["--session", sessionName, "action", "close-pane"]);

    if (result.exitCode !== 0) {
      // If pane doesn't exist, treat as success (idempotent)
      if (!(result.stderr.includes("no pane") || result.stderr.includes("not found"))) {
        throw new ZellijCliError(
          `close-pane --session ${sessionName}`,
          result.exitCode,
          result.stderr
        );
      }
    }
  }

  /**
   * Calculate resulting dimensions after a resize operation.
   */
  private calculateResizedDimensions(
    current: PaneDimensions,
    direction: "left" | "right" | "up" | "down",
    amount: number
  ): PaneDimensions {
    const result = { ...current };
    switch (direction) {
      case "left":
        result.cols = Math.max(1, result.cols - amount);
        break;
      case "right":
        result.cols += amount;
        break;
      case "up":
        result.rows = Math.max(1, result.rows - amount);
        break;
      case "down":
        result.rows += amount;
        break;
      default:
        break;
    }
    return result;
  }

  private validateSplitForNewPane(sessionName: string, direction: "horizontal" | "vertical"): void {
    const currentTopology = this.topology.getTopology(sessionName);
    if (!currentTopology) {
      return;
    }

    const activeTab = currentTopology.tabs.find(t => t.tabId === currentTopology.activeTabId);
    if (!activeTab || activeTab.panes.length === 0) {
      return;
    }

    const focusedPane = activeTab.panes.find(p => p.focused) ?? activeTab.panes[0];
    if (!focusedPane) {
      return;
    }
    this.validateSplit(focusedPane.dimensions, direction);
  }

  private async spawnPanePty(
    sessionName: string,
    laneId: string,
    paneId: number,
    dimensions: PaneDimensions,
    cwd?: string
  ): Promise<string | undefined> {
    if (!this.ptyManager) {
      return undefined;
    }

    try {
      const spawnOpts: Parameters<PtyManagerInterface["spawn"]>[0] = {
        laneId,
        sessionId: sessionName,
        terminalId: String(paneId),
        cols: dimensions.cols,
        rows: dimensions.rows,
      };
      if (cwd) {
        spawnOpts.cwd = cwd;
      }
      const ptyResult = await this.ptyManager.spawn(spawnOpts);
      this.topology.bindPty(sessionName, paneId, ptyResult.ptyId);
      return ptyResult.ptyId;
    } catch (err) {
      await this.closePaneRaw(sessionName, paneId).catch(_cleanupErr => {
        // Ignore cleanup failures while surfacing original PTY bind issue.
        // Keep cleanup best-effort; primary failure remains deterministic.
        return;
      });
      throw new PtyBindingError(paneId, err instanceof Error ? err.message : String(err));
    }
  }
}
