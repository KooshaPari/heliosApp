/**
 * T006 - Pane create, close, and resize operations.
 * T008 - PTY lifecycle integration for pane operations.
 * T009 - Minimum pane dimension enforcement.
 *
 * Manages terminal panes within zellij sessions, with PTY lifecycle
 * integration (spec 007) and dimension enforcement (FR-009-007).
 */

import type { ZellijCli } from "./cli.js";
import type { TopologyTracker } from "./topology.js";
import type {
  PaneRecord,
  PaneDimensions,
  CreatePaneOptions,
  MinPaneDimensions,
  PtyManagerInterface,
} from "./types.js";
import {
  PaneTooSmallError,
} from "./errors.js";
import { createZellijPane } from "./panes/create.js";
import { closeZellijPane } from "./panes/close.js";
import { resizeZellijPane } from "./panes/resize.js";
import { validatePaneDimensions } from "./panes/dimensions.js";

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
    options?: CreatePaneOptions,
  ): Promise<PaneRecord> {
    const direction = options?.direction ?? "vertical";

    // T009: Check minimum dimension enforcement before split
    const currentTopology = this.topology.getTopology(sessionName);
    if (currentTopology) {
      const activeTab = currentTopology.tabs.find(
        (t) => t.tabId === currentTopology.activeTabId,
      );
      if (activeTab && activeTab.panes.length > 0) {
        // Find the focused pane (the one being split)
        const focusedPane =
          activeTab.panes.find((p) => p.focused) ?? activeTab.panes[0]!;
        this.validateSplit(focusedPane.dimensions, direction);
      }
    }
    const paneId = ++this.paneCounter;
    return createZellijPane({
      cli: this.cli,
      topology: this.topology,
      ptyManager: this.ptyManager,
      laneId,
      sessionName,
      paneId,
      options,
    });
  }

  /**
   * T006 - Close a pane in a session.
   * T008 - Terminates the PTY before closing the pane.
   */
  async closePane(sessionName: string, paneId: number): Promise<void> {
    await closeZellijPane({
      cli: this.cli,
      topology: this.topology,
      ptyManager: this.ptyManager,
      sessionName,
      paneId,
    });
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
    amount: number,
  ): Promise<void> {
    await resizeZellijPane({
      cli: this.cli,
      topology: this.topology,
      ptyManager: this.ptyManager,
      sessionName,
      paneId,
      direction,
      amount,
      validateDimensions: (dimensions) =>
        this.validateDimensions(dimensions),
    });
  }

  /**
   * T009 - Validate that a split would produce panes above minimum dimensions.
   */
  validateSplit(
    parentDimensions: PaneDimensions,
    direction: "horizontal" | "vertical",
  ): void {
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
    validatePaneDimensions(dimensions, this.minDimensions);
  }

  /**
   * Get the current minimum dimension configuration.
   */
  getMinDimensions(): MinPaneDimensions {
    return { ...this.minDimensions };
  }
}
