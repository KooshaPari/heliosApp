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
      } catch (error) {
        console.warn(
          `[zellij-panes] PTY terminate for pane ${paneId} failed (may already be stopped):`,
          error,
        );
      }
    }
  }

  await closePaneRaw(cli, sessionName);
  topology.removePane(sessionName, paneId);
  console.debug(`[zellij-panes] mux.pane.closed: session=${sessionName} pane=${paneId}`);
}
