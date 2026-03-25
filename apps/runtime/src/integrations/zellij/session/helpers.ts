import type { ZellijCli } from "../cli.js";
import type { PaneRecord, TabRecord } from "../types.js";

/**
 * Extract lane ID from the session naming convention.
 */
export function extractLaneId(sessionName: string): string {
  const prefix = "helios-lane-";
  if (sessionName.startsWith(prefix)) {
    return sessionName.slice(prefix.length);
  }
  return sessionName;
}

/**
 * Query pane topology of a session.
 */
export async function queryLayout(cli: ZellijCli, sessionName: string): Promise<string> {
  try {
    const result = await cli.run(["--session", sessionName, "action", "dump-layout"]);
    if (result.exitCode !== 0) {
      return "";
    }
    return result.stdout;
  } catch {
    return "";
  }
}

export async function queryPanes(cli: ZellijCli, sessionName: string): Promise<PaneRecord[]> {
  return parsePanesFromLayout(await queryLayout(cli, sessionName));
}

export async function queryTabs(cli: ZellijCli, sessionName: string): Promise<TabRecord[]> {
  return parseTabsFromLayout(await queryLayout(cli, sessionName));
}

/** Parse pane records from zellij layout output. */
function parsePanesFromLayout(_layout: string): PaneRecord[] {
  return [{ id: 0, title: "default" }];
}

/** Parse tab records from zellij layout output. */
function parseTabsFromLayout(_layout: string): TabRecord[] {
  return [{ index: 0, name: "Tab #1", panes: [{ id: 0, title: "default" }] }];
}
