import { describe, expect, it, mock } from "bun:test";
import type { ZellijCli } from "../cli.js";
import { refreshSessionTopology } from "../topology/refresh.js";
import type { LayoutTopology } from "../types.js";

function makeMockCli(stdout: string, exitCode = 0): ZellijCli {
  return {
    run: mock(async () => ({ stdout, stderr: "", exitCode })),
    checkAvailability: mock(async () => ({ available: true })),
    listSessions: mock(async () => []),
  } as unknown as ZellijCli;
}

describe("refreshSessionTopology", () => {
  it("rebuilds topology from dump output and preserves PTY bindings", async () => {
    const cli = makeMockCli(
      [
        'tab name="Main" focus=true',
        "pane size_cols=120 size_rows=40 focus=true",
        "pane size_cols=80 size_rows=24",
      ].join("\n")
    );

    const existingTopology: LayoutTopology = {
      sessionName: "session-1",
      tabs: [
        {
          tabId: 0,
          name: "Main",
          layout: "horizontal",
          panes: [
            {
              paneId: 0,
              dimensions: { cols: 80, rows: 24 },
              focused: true,
              ptyId: "pty-keep",
            },
          ],
        },
      ],
      activeTabId: 0,
    };

    const topology = await refreshSessionTopology(cli, "session-1", existingTopology);

    expect(topology.sessionName).toBe("session-1");
    expect(topology.tabs).toHaveLength(1);
    expect(topology.tabs[0]?.panes).toHaveLength(2);
    expect(topology.tabs[0]?.panes[0]?.ptyId).toBe("pty-keep");
    expect(topology.tabs[0]?.panes[0]?.dimensions).toEqual({
      cols: 120,
      rows: 40,
    });
    expect(topology.tabs[0]?.panes[1]?.dimensions).toEqual({
      cols: 80,
      rows: 24,
    });
    expect(cli.run).toHaveBeenCalledWith(["--session", "session-1", "action", "dump-layout"]);
  });

  it("falls back to a minimal topology when dump-layout fails", async () => {
    const cli = makeMockCli("", 1);
    const existingTopology: LayoutTopology = {
      sessionName: "session-2",
      tabs: [
        {
          tabId: 0,
          name: "Main",
          layout: "horizontal",
          panes: [
            {
              paneId: 0,
              dimensions: { cols: 80, rows: 24 },
              focused: true,
              ptyId: "pty-keep",
            },
          ],
        },
      ],
      activeTabId: 0,
    };

    const topology = await refreshSessionTopology(cli, "session-2", existingTopology);

    expect(topology.tabs).toHaveLength(1);
    expect(topology.tabs[0]?.panes).toHaveLength(1);
    expect(topology.tabs[0]?.panes[0]?.ptyId).toBe("pty-keep");
  });
});
