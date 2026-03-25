import { describe, expect, it } from "bun:test";
import { parseLayoutDump } from "../topology/parser.js";

describe("parseLayoutDump", () => {
  it("parses tabs, panes, dimensions, and active focus state", () => {
    const topology = parseLayoutDump(
      "session-1",
      [
        'tab name="Main" focus=true',
        "pane size_cols=120 size_rows=40 focus=true",
        "pane size_cols=80 size_rows=24",
        'tab name="Logs"',
        "pane size_cols=100 size_rows=30 focus=true",
      ].join("\n"),
    );

    expect(topology.sessionName).toBe("session-1");
    expect(topology.tabs).toHaveLength(2);
    expect(topology.activeTabId).toBe(0);

    expect(topology.tabs[0]!.name).toBe("Main");
    expect(topology.tabs[0]!.panes).toHaveLength(2);
    expect(topology.tabs[0]!.panes[0]!.paneId).toBe(0);
    expect(topology.tabs[0]!.panes[0]!.focused).toBe(true);
    expect(topology.tabs[0]!.panes[0]!.dimensions).toEqual({
      cols: 120,
      rows: 40,
    });
    expect(topology.tabs[0]!.panes[1]!.paneId).toBe(1);
    expect(topology.tabs[0]!.panes[1]!.dimensions).toEqual({
      cols: 80,
      rows: 24,
    });

    expect(topology.tabs[1]!.name).toBe("Logs");
    expect(topology.tabs[1]!.panes).toHaveLength(1);
    expect(topology.tabs[1]!.panes[0]!.paneId).toBe(2);
    expect(topology.tabs[1]!.panes[0]!.focused).toBe(true);
    expect(topology.tabs[1]!.panes[0]!.dimensions).toEqual({
      cols: 100,
      rows: 30,
    });
  });

  it("returns a minimal topology when the dump is empty", () => {
    const topology = parseLayoutDump("session-2", "");

    expect(topology.sessionName).toBe("session-2");
    expect(topology.tabs).toHaveLength(1);
    expect(topology.tabs[0]!.panes).toHaveLength(1);
    expect(topology.tabs[0]!.panes[0]!.focused).toBe(true);
    expect(topology.tabs[0]!.panes[0]!.dimensions).toEqual({
      cols: 80,
      rows: 24,
    });
  });
});
