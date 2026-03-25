import type { ZellijCli } from "../cli.js";
import type { LayoutTopology } from "../types.js";
import { parseLayoutDump } from "./parser.js";

function collectPtyBindings(topology: LayoutTopology | undefined): Map<number, string> {
  const ptyBindings = new Map<number, string>();
  if (!topology) return ptyBindings;

  for (const tab of topology.tabs) {
    for (const pane of tab.panes) {
      if (pane.ptyId) {
        ptyBindings.set(pane.paneId, pane.ptyId);
      }
    }
  }

  return ptyBindings;
}

export async function refreshSessionTopology(
  cli: ZellijCli,
  sessionName: string,
  existingTopology?: LayoutTopology,
): Promise<LayoutTopology> {
  const result = await cli.run(["--session", sessionName, "action", "dump-layout"]);
  const ptyBindings = collectPtyBindings(existingTopology);

  let topology: LayoutTopology;
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    topology = {
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
  } else {
    topology = parseLayoutDump(sessionName, result.stdout);
  }

  for (const tab of topology.tabs) {
    for (const pane of tab.panes) {
      const ptyId = ptyBindings.get(pane.paneId);
      if (ptyId) {
        pane.ptyId = ptyId;
      }
    }
  }

  return topology;
}
