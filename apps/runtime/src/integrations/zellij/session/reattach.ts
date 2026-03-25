import type { ZellijCli } from "../cli.js";
import { SessionNotFoundError } from "../errors.js";
import type { MuxEventEmitter, SessionReattachedEvent } from "../events.js";
import { MuxEventType } from "../events.js";
import type { MuxRegistry } from "../registry.js";
import type { TopologyTracker } from "../topology.js";
import type { MuxSession, PaneRecord, PtyManagerInterface, TabRecord } from "../types.js";
import { extractLaneId, queryPanes, queryTabs } from "./helpers.js";

export async function reattachZellijSession(args: {
  cli: ZellijCli;
  registry: MuxRegistry;
  topology?: TopologyTracker;
  ptyManager?: PtyManagerInterface;
  emitter?: MuxEventEmitter;
  sessionName: string;
}): Promise<MuxSession> {
  const { cli, registry, topology, ptyManager, emitter, sessionName } = args;
  const startMs = performance.now();

  const sessions = await cli.listSessions();
  const target = sessions.find(s => s.name === sessionName);
  if (!target) {
    throw new SessionNotFoundError(sessionName);
  }

  const laneId = extractLaneId(sessionName);
  let panes: PaneRecord[];
  let tabs: TabRecord[];

  if (topology) {
    const layout = await topology.refreshTopology(sessionName);
    panes = [];
    tabs = [];

    for (const tabTopo of layout.tabs) {
      const tabPanes: PaneRecord[] = [];
      for (const paneTopo of tabTopo.panes) {
        const record: PaneRecord = {
          id: paneTopo.paneId,
          title: `pane-${paneTopo.paneId}`,
          dimensions: { ...paneTopo.dimensions },
          ptyId: paneTopo.ptyId,
        };
        panes.push(record);
        tabPanes.push(record);

        if (ptyManager && !paneTopo.ptyId) {
          try {
            const ptyResult = await ptyManager.spawn({
              laneId,
              sessionId: sessionName,
              terminalId: String(paneTopo.paneId),
              cols: paneTopo.dimensions.cols,
              rows: paneTopo.dimensions.rows,
            });
            topology.bindPty(sessionName, paneTopo.paneId, ptyResult.ptyId);
            record.ptyId = ptyResult.ptyId;
          } catch (_error) {}
        }
      }

      tabs.push({
        index: tabTopo.tabId,
        name: tabTopo.name,
        panes: tabPanes,
      });
    }
  } else {
    panes = await queryPanes(cli, sessionName);
    tabs = await queryTabs(cli, sessionName);
  }

  const _durationMs = performance.now() - startMs;

  const muxSession: MuxSession = {
    sessionName,
    laneId,
    createdAt: target.created,
    panes,
    tabs,
  };

  registry.unbind(sessionName);
  registry.bind(sessionName, laneId, muxSession);

  if (emitter) {
    emitter.emitTyped<SessionReattachedEvent>({
      type: MuxEventType.SESSION_REATTACHED,
      sessionName,
      laneId,
      recoveredPaneCount: panes.length,
      recoveredTabCount: tabs.length,
    });
  }

  return muxSession;
}
