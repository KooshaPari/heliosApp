import { describe, expect, it } from "bun:test";
import { createMockTabSurface } from "../../../src/tabs/tab_surface";

describe("TabSurface", () => {
  it("creates a mock tab surface and exposes its state", () => {
    const tab = createMockTabSurface("tab-1", "project", "Project");

    expect(tab.getTabId()).toBe("tab-1");
    expect(tab.getTabType()).toBe("project");
    expect(tab.getLabel()).toBe("Project");

    const state = tab.getState();
    expect(state.tabId).toBe("tab-1");
    expect(state.tabType).toBe("project");
    expect(state.label).toBe("Project");

    const rendered = tab.renderWithErrorBoundary();
    expect(rendered).toBeDefined();
    expect(rendered.textContent).toContain("Project");
  });
});
