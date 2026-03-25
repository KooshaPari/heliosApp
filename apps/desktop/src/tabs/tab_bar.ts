import type { TabSurface } from "./tab_surface";
import {
  focusTabElement,
  getOrderedTabs,
  renderTabHeader,
} from "./tab_bar_helpers";

export interface TabBarConfig {
  onTabSelected?: (tabId: string) => void;
  onTabReordered?: (tabIds: string[]) => void;
  onTabPinned?: (tabId: string, pinned: boolean) => void;
}

/**
 * TabBar manages the display and interaction of tab headers.
 *
 * Features:
 * - Renders tab headers with labels and selection highlighting.
 * - Handles tab selection via click or keyboard (Enter/Space).
 * - Supports tab reordering via drag-and-drop or keyboard.
 * - Supports tab pinning with visual indicators.
 * - Displays stale-context warning indicators.
 * - Full keyboard accessibility (Tab/Shift-Tab, Arrow keys).
 */
export class TabBar {
  private tabs: TabSurface[] = [];
  private selectedTabId: string | null = null;
  private pinnedTabIds = new Set<string>();
  private tabOrder: string[] = [];
  private focusedTabIndex: number = 0;
  private draggedTabId: string | null = null;
  private config: Required<TabBarConfig>;
  private container: HTMLElement | null = null;

  constructor(tabs: TabSurface[], config: TabBarConfig = {}) {
    this.tabs = tabs;
    this.tabOrder = tabs.map((t) => t.getTabId());
    this.selectedTabId = tabs.length > 0 ? tabs[0].getTabId() : null;
    this.config = {
      onTabSelected: config.onTabSelected ?? (() => {}),
      onTabReordered: config.onTabReordered ?? (() => {}),
      onTabPinned: config.onTabPinned ?? (() => {})
    };
  }

  /**
   * Get the currently selected tab ID.
   */
  getSelectedTabId(): string | null {
    return this.selectedTabId;
  }

  /**
   * Select a tab by ID.
   */
  selectTab(tabId: string): void {
    const tab = this.tabs.find((t) => t.getTabId() === tabId);
    if (!tab) return;

    // Deactivate previous tab
    if (this.selectedTabId) {
      const prevTab = this.tabs.find((t) => t.getTabId() === this.selectedTabId);
      if (prevTab) {
        prevTab.onDeactivate();
      }
    }

    // Activate new tab
    this.selectedTabId = tabId;
    tab.onActivate();
    this.config.onTabSelected(tabId);
  }

  /**
   * Get the tab order.
   */
  getTabOrder(): string[] {
    return [...this.tabOrder];
  }

  /**
   * Return tabs in their current display order, respecting pinning.
   */
  private getOrderedTabs(): TabSurface[] {
    return getOrderedTabs(this.tabs, this.tabOrder, this.pinnedTabIds);
  }

  /**
   * Reorder tabs.
   */
  reorderTabs(newOrder: string[]): void {
    // Validate that all tab IDs are present
    const tabIds = new Set(this.tabs.map((t) => t.getTabId()));
    const newOrderSet = new Set(newOrder);

    if (
      newOrder.length !== this.tabs.length ||
      ![...tabIds].every((id) => newOrderSet.has(id))
    ) {
      console.error("Invalid tab order: missing or extra tab IDs");
      return;
    }

    this.tabOrder = newOrder;
    this.config.onTabReordered(newOrder);
  }

  /**
   * Pin a tab so it appears first and cannot be reordered past other pinned tabs.
   */
  pinTab(tabId: string, pinned: boolean = true): void {
    const tab = this.tabs.find((t) => t.getTabId() === tabId);
    if (!tab) return;

    if (pinned) {
      this.pinnedTabIds.add(tabId);
    } else {
      this.pinnedTabIds.delete(tabId);
    }

    this.tabOrder = [
      ...this.tabOrder.filter((id) => this.pinnedTabIds.has(id)),
      ...this.tabOrder.filter((id) => !this.pinnedTabIds.has(id))
    ];
    this.config.onTabPinned(tabId, pinned);
  }

  /**
   * Check if a tab is pinned.
   */
  isTabPinned(tabId: string): boolean {
    return this.pinnedTabIds.has(tabId);
  }

  /**
   * Render the tab bar.
   */
  render(): HTMLElement {
    const container = document.createElement("div");
    container.className = "tab-bar";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.borderBottom = "1px solid #e0e0e0";
    container.style.backgroundColor = "#f5f5f5";
    container.style.padding = "0 8px";
    container.style.gap = "0";

    this.container = container;

    const orderedTabs = this.getOrderedTabs();

    orderedTabs.forEach((tab, index) => {
      container.appendChild(
        renderTabHeader(tab, index, {
          selectedTabId: this.selectedTabId,
          focusedTabIndex: this.focusedTabIndex,
          pinnedTabIds: this.pinnedTabIds,
          onTabSelected: (tabId) => this.selectTab(tabId),
          onTabKeydown: (event, tabId) => this.handleTabKeydown(event, tabId),
          onTabDrop: (targetTabId) => this.handleTabDrop(targetTabId),
          onDragStart: (tabId) => {
            this.draggedTabId = tabId;
          },
          onDragEnd: () => {
            this.draggedTabId = null;
          },
        })
      );
    });

    return container;
  }

  /**
   * Handle keyboard navigation in tab headers.
   */
  private handleTabKeydown(event: KeyboardEvent, tabId: string): void {
    const orderedTabs = this.getOrderedTabs();
    const currentIndex = orderedTabs.findIndex((t) => t.getTabId() === tabId);

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        this.selectTab(tabId);
        break;

      case "ArrowRight":
        event.preventDefault();
        if (currentIndex < orderedTabs.length - 1) {
          const nextTab = orderedTabs[currentIndex + 1];
          this.focusedTabIndex = currentIndex + 1;
          focusTabElement(this.container, nextTab.getTabId());
        }
        break;

      case "ArrowLeft":
        event.preventDefault();
        if (currentIndex > 0) {
          const prevTab = orderedTabs[currentIndex - 1];
          this.focusedTabIndex = currentIndex - 1;
          focusTabElement(this.container, prevTab.getTabId());
        }
        break;

      case "Tab":
        // Allow natural Tab behavior to move focus out of tab bar
        break;

      default:
        break;
    }
  }

  /**
   * Handle tab drop/reorder.
   */
  private handleTabDrop(targetTabId: string): void {
    if (!this.draggedTabId || this.draggedTabId === targetTabId) {
      return;
    }

    const draggedIndex = this.tabOrder.indexOf(this.draggedTabId);
    const targetIndex = this.tabOrder.indexOf(targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // Reorder: remove dragged tab and insert before target
    const newOrder = [...this.tabOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, this.draggedTabId);

    this.reorderTabs(newOrder);
  }

  /**
   * Update the tab list.
   */
  updateTabs(tabs: TabSurface[]): void {
    this.tabs = tabs;
    // Preserve order where possible, add new tabs at the end
    const existingIds = new Set(this.tabOrder);
    const newIds = tabs.map((t) => t.getTabId());
    const addedIds = newIds.filter((id) => !existingIds.has(id));

    this.tabOrder = [...this.tabOrder.filter((id) => newIds.includes(id)), ...addedIds];

    // Remove selected if no longer exists
    if (this.selectedTabId && !newIds.includes(this.selectedTabId)) {
      this.selectTab(newIds[0] || "");
    }
  }
}
