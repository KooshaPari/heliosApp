import { TabNotFoundError } from "../errors.js";
import type { TopologyTracker } from "../topology.js";
import type { PtyManagerInterface, TabTopology } from "../types.js";

export function requireTabTopology(
  topologyTracker: TopologyTracker,
  sessionName: string,
  tabId: number
): { tab: TabTopology } {
  const topology = topologyTracker.getTopology(sessionName);
  if (!topology) {
    throw new TabNotFoundError(sessionName, tabId);
  }

  const tab = topology.tabs.find(candidate => candidate.tabId === tabId);
  if (!tab) {
    throw new TabNotFoundError(sessionName, tabId);
  }

  return { tab };
}

export async function terminateTabPtys(
  ptyManager: PtyManagerInterface | undefined,
  tab: TabTopology,
  _tabId: number
): Promise<void> {
  if (!ptyManager) {
    return;
  }

  for (const pane of tab.panes) {
    if (!pane.ptyId) {
      continue;
    }

    try {
      await ptyManager.terminate(pane.ptyId);
    } catch (_error) {}
  }
}
