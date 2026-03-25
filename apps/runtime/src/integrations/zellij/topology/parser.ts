import type { LayoutTopology, PaneTopology, TabTopology } from "../types.js";

/**
 * Parse zellij dump-layout output into a LayoutTopology.
 * Zellij dump-layout returns KDL format; we do a best-effort parse.
 */
export function parseLayoutDump(sessionName: string, output: string): LayoutTopology {
  const tabs: TabTopology[] = [];
  let activeTabId = 0;

  // Simple line-based parse for KDL layout output
  const lines = output.split("\n");
  let currentTabId = 0;
  let currentTabName = "Tab #1";
  let panes: PaneTopology[] = [];
  let paneCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect tab boundaries
    const tabMatch = trimmed.match(/tab\s+name="([^"]*)"(?:\s+focus=true)?/);
    if (tabMatch) {
      // Save previous tab if it had panes
      if (panes.length > 0) {
        tabs.push({
          tabId: currentTabId,
          name: currentTabName,
          panes: [...panes],
          layout: "horizontal",
        });
      }
      currentTabId = tabs.length;
      currentTabName = tabMatch[1] ?? `Tab #${currentTabId + 1}`;
      if (trimmed.includes("focus=true")) {
        activeTabId = currentTabId;
      }
      panes = [];
    }

    // Detect pane entries
    const paneMatch = trimmed.match(/pane\s+/);
    if (paneMatch) {
      const colsMatch = trimmed.match(/size_cols\s*=?\s*(\d+)/);
      const rowsMatch = trimmed.match(/size_rows\s*=?\s*(\d+)/);
      const focusMatch = trimmed.includes("focus=true");

      panes.push({
        paneId: paneCounter++,
        dimensions: {
          cols: colsMatch ? Number.parseInt(colsMatch[1]!, 10) : 80,
          rows: rowsMatch ? Number.parseInt(rowsMatch[1]!, 10) : 24,
        },
        focused: focusMatch,
      });
    }
  }

  // Push the last tab
  if (panes.length > 0) {
    tabs.push({
      tabId: currentTabId,
      name: currentTabName,
      panes,
      layout: "horizontal",
    });
  }

  // If nothing was parsed, return minimal topology
  if (tabs.length === 0) {
    tabs.push({
      tabId: 0,
      name: "Tab #1",
      panes: [{ paneId: 0, dimensions: { cols: 80, rows: 24 }, focused: true }],
      layout: "horizontal",
    });
  }

  return { sessionName, tabs, activeTabId };
}
