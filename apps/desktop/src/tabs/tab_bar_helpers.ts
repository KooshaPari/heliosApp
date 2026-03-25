import type { TabSurface } from "./tab_surface.ts";

export interface TabBarRenderContext {
  selectedTabId: string | null;
  focusedTabIndex: number;
  pinnedTabIds: Set<string>;
  onTabSelected(tabId: string): void;
  onTabKeydown(event: KeyboardEvent, tabId: string): void;
  onTabDrop(targetTabId: string): void;
  onDragStart(tabId: string): void;
  onDragEnd(): void;
}

export function getOrderedTabs(
  tabs: TabSurface[],
  tabOrder: string[],
  pinnedTabIds: Set<string>
): TabSurface[] {
  const tabMap = new Map(tabs.map(tab => [tab.getTabId(), tab]));
  const pinned = tabOrder.filter(id => pinnedTabIds.has(id));
  const unpinned = tabOrder.filter(id => !pinnedTabIds.has(id));

  return [...pinned, ...unpinned]
    .map(id => tabMap.get(id))
    .filter((tab): tab is TabSurface => tab !== undefined);
}

export function renderTabHeader(
  tab: TabSurface,
  index: number,
  context: TabBarRenderContext
): HTMLElement {
  const isSelected = tab.getTabId() === context.selectedTabId;
  const hasStaleContext = tab.hasStaleContext();

  const headerEl = document.createElement("button");
  headerEl.className = "tab-header";
  headerEl.setAttribute("data-tab-id", tab.getTabId());
  headerEl.setAttribute("tabindex", context.focusedTabIndex === index ? "0" : "-1");
  headerEl.style.flex = "1";
  headerEl.style.padding = "12px 16px";
  headerEl.style.border = "none";
  headerEl.style.backgroundColor = isSelected ? "#ffffff" : "#f5f5f5";
  headerEl.style.borderBottom = isSelected ? "2px solid #1976d2" : "2px solid transparent";
  headerEl.style.cursor = "pointer";
  headerEl.style.fontSize = "14px";
  headerEl.style.fontWeight = isSelected ? "600" : "400";
  headerEl.style.color = isSelected ? "#1976d2" : "#666";
  headerEl.style.transition = "all 0.2s ease";
  headerEl.style.display = "flex";
  headerEl.style.alignItems = "center";
  headerEl.style.gap = "8px";
  headerEl.style.whiteSpace = "nowrap";

  const labelEl = document.createElement("span");
  labelEl.textContent = tab.getLabel();
  headerEl.appendChild(labelEl);

  if (hasStaleContext) {
    const indicatorEl = document.createElement("span");
    indicatorEl.style.width = "8px";
    indicatorEl.style.height = "8px";
    indicatorEl.style.borderRadius = "50%";
    indicatorEl.style.backgroundColor = "#ff9800";
    indicatorEl.style.display = "inline-block";
    indicatorEl.title = "This tab may be showing stale data";
    headerEl.appendChild(indicatorEl);
  }

  if (context.pinnedTabIds.has(tab.getTabId())) {
    const pinEl = document.createElement("span");
    pinEl.textContent = "📌";
    pinEl.style.fontSize = "10px";
    pinEl.title = "Tab is pinned";
    headerEl.appendChild(pinEl);
  }

  headerEl.addEventListener("click", () => {
    context.onTabSelected(tab.getTabId());
  });

  headerEl.addEventListener("keydown", event => {
    context.onTabKeydown(event, tab.getTabId());
  });

  headerEl.addEventListener("dragstart", () => {
    context.onDragStart(tab.getTabId());
  });

  headerEl.addEventListener("dragover", event => {
    event.preventDefault();
    context.onTabDrop(tab.getTabId());
  });

  headerEl.addEventListener("drop", event => {
    event.preventDefault();
    context.onTabDrop(tab.getTabId());
  });

  headerEl.addEventListener("dragend", () => {
    context.onDragEnd();
  });

  headerEl.draggable = true;
  return headerEl;
}

export function focusTabElement(container: HTMLElement | null, tabId: string): void {
  if (!container) {
    return;
  }

  const tabEl = container.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
  if (!tabEl) {
    return;
  }

  tabEl.setAttribute("tabindex", "0");
  tabEl.focus();

  const allTabs = container.querySelectorAll("[data-tab-id]");
  allTabs.forEach(el => {
    if (el !== tabEl) {
      (el as HTMLElement).setAttribute("tabindex", "-1");
    }
  });
}
