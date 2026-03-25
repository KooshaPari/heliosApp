import type { ZellijCli } from "../cli.js";
import type { TopologyTracker } from "../topology.js";
import type { PtyManagerInterface } from "../types.js";
import { closePaneRaw } from "./commands.js";

export async function closeZellijPane(args: {
  cli: ZellijCli;
  topology: TopologyTracker;
  ptyManager: PtyManagerInterface | undefined;
  sessionName: string;
  paneId: number;
}): Promise<void> {
  const { cli, topology, ptyManager, sessionName, paneId } = args;

  if (ptyManager) {
    const paneTopology = topology.findPane(sessionName, paneId);
    if (paneTopology?.ptyId) {
      try {
        await ptyManager.terminate(paneTopology.ptyId);
      } catch (_error) {}
    }
  }

  await closePaneRaw(cli, sessionName);
  topology.removePane(sessionName, paneId);
}
