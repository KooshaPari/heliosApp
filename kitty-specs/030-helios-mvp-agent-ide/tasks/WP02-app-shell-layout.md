---
work_package_id: WP02
title: App Shell Layout
lane: "for_review"
dependencies: []
base_branch: main
base_commit: 4f2ebc164379da1ac771b5cd51649eedff6c888e
created_at: '2026-03-01T11:10:48.384119+00:00'
subtasks: [T015, T016, T017, T018]
shell_pid: "70901"
agent: "claude-opus"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP02: App Shell Layout

**Implementation command**: `spec-kitty implement WP02 --base WP01`

## Objective

Build the main application shell with a Cursor/Windsurf-inspired layout: collapsible left sidebar for conversation history, center panel for chat, bottom panel for terminal, and a status bar. Support resizable panels and keyboard shortcuts.

## Context

The UI should look like modern AI-first coding assistants (Cursor, Windsurf). Key layout elements:
- **Left sidebar** (~250px, collapsible): Shows conversation threads, "New Chat" button
- **Center panel** (flex-grow): Main chat area (WP03 will populate)
- **Bottom panel** (~300px, resizable): Terminal (WP05 will populate)
- **Status bar** (fixed, ~24px): Connection status, active model, session info
- **Top bar** (optional, ~40px): App title, window controls

Dark theme matching the screenshots the user provided (dark gray backgrounds, subtle borders, clean typography).

**Reference**: Study `src/renderers/ivde/` for SolidJS patterns used in this project.

**Existing styles**: The project uses Tailwind CSS (`tailwindcss: ^3.4.3`).

## Subtasks

### T015: Build AppShell Layout Component

**Purpose**: Create the root layout component that arranges all panels.

**Steps**:
1. Create `src/renderers/helios/components/AppShell.tsx`:
   - Use CSS Grid for the main layout: `grid-template-rows: auto 1fr auto` (topbar, content, statusbar)
   - Content area: `grid-template-columns: auto 1fr` (sidebar, main)
   - Main area: vertical split for chat + terminal

2. Implement resizable panel dividers:
   - Sidebar width: draggable divider (min 200px, max 400px, default 260px)
   - Terminal height: draggable divider (min 100px, max 60vh, default 300px)
   - Store sizes in a SolidJS signal, persist to localStorage

3. Style with dark theme:
   - Background: `#1e1e2e` (main), `#181825` (sidebar), `#11111b` (terminal)
   - Borders: `#313244` (subtle)
   - Text: `#cdd6f4` (primary), `#a6adc8` (secondary)
   - Font: system monospace stack

**Files**:
- `src/renderers/helios/components/AppShell.tsx` (new, ~120 lines)
- `src/renderers/helios/styles/theme.css` (new, ~60 lines)

**Validation**:
- [ ] Layout renders with all panels visible
- [ ] Sidebar collapses/expands on toggle
- [ ] Panel dividers are draggable
- [ ] Resize state persists across page reloads

---

### T016: Build Sidebar Component

**Purpose**: Create the left sidebar showing conversation list and navigation.

**Steps**:
1. Create `src/renderers/helios/components/sidebar/Sidebar.tsx`:
   - "New Chat" button at top (prominent, styled)
   - Scrollable conversation list below
   - Each conversation item shows: title (truncated), relative timestamp
   - Active conversation highlighted
   - Hover effects for interactivity

2. Create `src/renderers/helios/components/sidebar/ConversationItem.tsx`:
   - Props: `{ id, title, updatedAt, isActive, onClick }`
   - Shows title with ellipsis overflow
   - Shows "2m ago", "1h ago", "Yesterday" style timestamps
   - Active state: left border accent + background highlight

3. For now, use mock data — real persistence wiring happens in WP06.

**Files**:
- `src/renderers/helios/components/sidebar/Sidebar.tsx` (new, ~70 lines)
- `src/renderers/helios/components/sidebar/ConversationItem.tsx` (new, ~45 lines)

**Validation**:
- [ ] Sidebar renders with mock conversations
- [ ] "New Chat" button is visible and clickable
- [ ] Active conversation is visually distinct
- [ ] Long titles truncate with ellipsis

---

### T017: Build StatusBar Component

**Purpose**: Create the bottom status bar showing connection and model info.

**Steps**:
1. Create `src/renderers/helios/components/common/StatusBar.tsx`:
   - Left section: Connection indicator (green dot = connected, red = disconnected)
   - Center section: Active model name (e.g., "claude-sonnet-4-20250514")
   - Right section: Session duration, terminal count

2. Style: Small text (12px), fixed height (24px), dark background with top border.

**Files**:
- `src/renderers/helios/components/common/StatusBar.tsx` (new, ~40 lines)

**Validation**:
- [ ] Status bar renders at bottom of window
- [ ] Connection indicator shows correct state
- [ ] Model name is displayed

---

### T018: Add Keyboard Shortcuts

**Purpose**: Wire global keyboard shortcuts for common actions.

**Steps**:
1. Create `src/renderers/helios/shortcuts.ts`:
   - Register keydown listener on document
   - Shortcuts:
     - `Ctrl+N` / `Cmd+N`: New conversation
     - `Ctrl+\`` / `Cmd+\``: Toggle terminal panel
     - `Ctrl+B` / `Cmd+B`: Toggle sidebar
     - `Ctrl+1-5`: Switch to tab 1-5 (for future use)
   - Use `e.metaKey || e.ctrlKey` for cross-platform
   - Prevent default browser behavior for captured shortcuts

2. Wire shortcuts in App.tsx via `onMount`/`onCleanup`.

**Files**:
- `src/renderers/helios/shortcuts.ts` (new, ~50 lines)
- `src/renderers/helios/App.tsx` (modify, add shortcut wiring)

**Validation**:
- [ ] Ctrl+B toggles sidebar visibility
- [ ] Ctrl+` toggles terminal panel
- [ ] Shortcuts don't conflict with terminal input when terminal is focused

---

## Definition of Done

- [ ] App shell renders with sidebar, center, bottom, and status bar panels
- [ ] Panels are resizable via drag
- [ ] Sidebar shows mock conversation list
- [ ] Keyboard shortcuts work
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- Tailwind CSS may need PostCSS configuration for ElectroBun's esbuild pipeline
- Resizable panels need careful pointer event handling
- Keyboard shortcuts must not interfere with terminal input

## Reviewer Guidance

- Verify the layout matches Cursor/Windsurf style (dark theme, clean panels)
- Check that resize state persists
- Verify keyboard shortcuts work on macOS (Cmd) and would work on Linux (Ctrl)

## Activity Log

- 2026-03-01T11:10:48Z – claude-opus – shell_pid=70901 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:15:01Z – claude-opus – shell_pid=70901 – lane=for_review – App shell with sidebar, status bar, shortcuts
