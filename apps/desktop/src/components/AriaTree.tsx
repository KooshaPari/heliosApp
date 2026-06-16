// apps/desktop/src/components/AriaTree.tsx
// ARIA tree pattern for the file tree. Implements the WAI-ARIA treeview
// design pattern with proper role="tree" / role="treeitem" / aria-expanded
// / aria-selected / aria-level, and roving tabindex arrow-key navigation.
//
// Reference: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/

import { For, type Component, createSignal } from "solid-js";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

interface AriaTreeProps {
  nodes: TreeNode[];
  "aria-label": string;
  onActivate?: (id: string) => void;
}

export const AriaTree: Component<AriaTreeProps> = (props) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [focusedId, setFocusedId] = createSignal<string | null>(null);

  const flatten = (nodes: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const n of nodes) {
      out.push(n);
      if (n.children) out.push(...flatten(n.children));
    }
    return out;
  };

  const allNodes = (): TreeNode[] => flatten(props.nodes);

  const onKey = (e: KeyboardEvent) => {
    const ids = allNodes().map((n) => n.id);
    const current = focusedId();
    if (!current) return;
    const idx = ids.indexOf(current);
    if (idx < 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (idx < ids.length - 1) setFocusedId(ids[idx + 1]);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (idx > 0) setFocusedId(ids[idx - 1]);
        break;
      case "Home":
        e.preventDefault();
        setFocusedId(ids[0]);
        break;
      case "End":
        e.preventDefault();
        setFocusedId(ids[ids.length - 1]);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setSelectedId(current);
        props.onActivate?.(current);
        break;
    }
  };

  return (
    <ul
      role="tree"
      aria-label={props["aria-label"]}
      onKeyDown={onKey}
      class="aria-tree"
    >
      <For each={props.nodes}>
        {(node) => (
          <AriaTreeItem
            node={node}
            level={1}
            expanded={createSignal(false)}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            focusedId={focusedId}
            setFocusedId={setFocusedId}
            onActivate={props.onActivate}
          />
        )}
      </For>
    </ul>
  );
};

interface AriaTreeItemProps {
  node: TreeNode;
  level: number;
  expanded: ReturnType<typeof createSignal<boolean>>;
  selectedId: () => string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: () => string | null;
  setFocusedId: (id: string | null) => void;
  onActivate?: (id: string) => void;
}

const AriaTreeItem: Component<AriaTreeItemProps> = (props) => {
  const [isOpen, setIsOpen] = props.expanded;
  const hasChildren = () =>
    Array.isArray(props.node.children) && props.node.children.length > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren() ? isOpen() : undefined}
      aria-selected={props.selectedId() === props.node.id}
      aria-level={props.level}
      tabindex={props.focusedId() === props.node.id ? 0 : -1}
      onClick={() => {
        if (hasChildren()) setIsOpen(!isOpen());
        props.setSelectedId(props.node.id);
        props.setFocusedId(props.node.id);
        props.onActivate?.(props.node.id);
      }}
    >
      {props.node.label}
      {hasChildren() && isOpen() && (
        <ul role="group">
          <For each={props.node.children}>
            {(child) => (
              <AriaTreeItem
                node={child}
                level={props.level + 1}
                expanded={createSignal(false)}
                selectedId={props.selectedId}
                setSelectedId={props.setSelectedId}
                focusedId={props.focusedId}
                setFocusedId={props.setFocusedId}
                onActivate={props.onActivate}
              />
            )}
          </For>
        </ul>
      )}
    </li>
  );
};
