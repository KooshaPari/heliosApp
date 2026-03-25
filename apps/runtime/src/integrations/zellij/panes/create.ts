import type { ZellijCli } from "../cli.js";
import { PtyBindingError, ZellijCliError } from "../errors.js";
import type { TopologyTracker } from "../topology.js";
import type {
  CreatePaneOptions,
  PaneDimensions,
  PaneRecord,
  PtyManagerInterface,
} from "../types.js";
import { buildCreatePaneArgs, closePaneRaw } from "./commands.js";

export async function createZellijPane(args: {
  cli: ZellijCli;
  topology: TopologyTracker;
  ptyManager: PtyManagerInterface | undefined;
  laneId: string;
  sessionName: string;
  paneId: number;
  options?: CreatePaneOptions;
}): Promise<PaneRecord> {
  const { cli, topology, ptyManager, laneId, sessionName, paneId, options } = args;
  const startMs = performance.now();
  const direction = options?.direction ?? "vertical";

  const result = await cli.run(buildCreatePaneArgs(sessionName, direction, options?.cwd));
  if (result.exitCode !== 0) {
    throw new ZellijCliError(`new-pane --session ${sessionName}`, result.exitCode, result.stderr);
  }

  const refreshed = await topology.refreshTopology(sessionName);
  const activeTab = refreshed.tabs.find(tab => tab.tabId === refreshed.activeTabId);
  const newPaneTopology = activeTab?.panes[activeTab.panes.length - 1];
  const dimensions: PaneDimensions = newPaneTopology?.dimensions ?? {
    cols: 80,
    rows: 24,
  };

  topology.addPane(sessionName, paneId, dimensions);

  let ptyId: string | undefined;
  if (ptyManager) {
    try {
      const spawnOpts: Parameters<PtyManagerInterface["spawn"]>[0] = {
        laneId,
        sessionId: sessionName,
        terminalId: String(paneId),
        cols: dimensions.cols,
        rows: dimensions.rows,
      };
      if (options?.cwd) {
        spawnOpts.cwd = options.cwd;
      }
      const ptyResult = await ptyManager.spawn(spawnOpts);
      ptyId = ptyResult.ptyId;
      topology.bindPty(sessionName, paneId, ptyId);
    } catch (error) {
      await closePaneRaw(cli, sessionName).catch(() => {});
      throw new PtyBindingError(paneId, error instanceof Error ? error.message : String(error));
    }
  }

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
