---
work_package_id: WP02
title: Pane and Tab Topology with Session-to-Lane Binding
lane: "planned"
dependencies:
- WP01
base_branch: 009-zellij-mux-session-adapter-WP01
base_commit: 4d8ac5d66b5a36f669c4f5567e254490c07ba200
created_at: '2026-02-27T12:14:53.698725+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 2 - Topology Management
assignee: ''
agent: "claude-wp02-009"
shell_pid: "65254"
review_status: "has_feedback"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Pane and Tab Topology with Session-to-Lane Binding

## Objectives & Success Criteria

- Deliver pane create, close, and resize operations within mux sessions.
- Deliver tab create, close, and switch operations.
- Integrate pane operations with PTY lifecycle (spec 007).
- Enforce minimum pane dimensions.
- Track layout topology for all sessions.

Success criteria:
- Pane add/remove completes in p95 < 500ms (NFR-009-002).
- Each pane is backed by a PTY instance from spec 007.
- Minimum pane dimensions are enforced; invalid splits are rejected.
- Topology tracking reflects the actual session layout.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/spec.md` (FR-009-003, FR-009-004, FR-009-007)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/plan.md`
- Spec 007 (PTY Lifecycle) for pane-level PTY operations

Constraints:
- Pane operations via zellij CLI.
- Minimum pane dimensions: 10 cols x 3 rows (configurable).
- Each pane must have a PTY; pane close must terminate the PTY.
- Adapter must not add > 2ms data-path latency (NFR-009-004).

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement pane create, close, and resize operations

- Purpose: manage terminal panes within zellij sessions.
- Steps:
  1. Implement pane operations in `apps/runtime/src/integrations/zellij/panes.ts`:
     - `createPane(sessionName: string, options?: { direction?: 'horizontal' | 'vertical', cwd?: string }): Promise<PaneRecord>`:
       a. Execute `zellij --session <sessionName> action new-pane --direction <dir>`.
       b. Query the session layout to get the new pane's ID and dimensions.
       c. Create a `PaneRecord`: `{ paneId, sessionName, dimensions: { cols, rows }, ptyId?: string, createdAt }`.
       d. Return the record.
     - `closePane(sessionName: string, paneId: string): Promise<void>`:
       a. Execute `zellij --session <sessionName> action close-pane --pane-id <paneId>`.
       b. Remove the pane from topology tracking.
     - `resizePane(sessionName: string, paneId: string, direction: string, amount: number): Promise<void>`:
       a. Execute `zellij --session <sessionName> action resize --pane-id <paneId> --direction <dir> --amount <amt>`.
       b. Update pane dimensions in topology.
  2. Measure operation latency for NFR-009-002.
  3. After each operation, refresh the topology to ensure consistency.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/panes.ts`
- Validation checklist:
  - [ ] Pane create adds a pane to the session.
  - [ ] Pane close removes the pane.
  - [ ] Resize updates dimensions.
  - [ ] Operation latency measured.
  - [ ] Topology refreshed after each op.
- Edge cases:
  - Create pane when session has only one pane: split works.
  - Close the last pane in a session: session may terminate; detect and handle.
  - Resize beyond session bounds: zellij may reject; parse error.

### Subtask T007 - Implement tab create, close, and switch operations

- Purpose: organize panes into tabs for context separation.
- Steps:
  1. Implement tab operations in `apps/runtime/src/integrations/zellij/tabs.ts`:
     - `createTab(sessionName: string, name?: string): Promise<TabRecord>`:
       a. Execute `zellij --session <sessionName> action new-tab --name <name>`.
       b. `TabRecord`: `{ tabId, sessionName, name, panes: PaneRecord[], createdAt }`.
     - `closeTab(sessionName: string, tabId: string): Promise<void>`:
       a. Close all panes in the tab (terminating their PTYs).
       b. Execute `zellij --session <sessionName> action close-tab`.
     - `switchTab(sessionName: string, tabId: string): Promise<void>`:
       a. Execute `zellij --session <sessionName> action go-to-tab --tab-position <pos>`.
  2. Track active tab per session.
  3. Publish tab lifecycle events: `mux.tab.created`, `mux.tab.closed`, `mux.tab.switched`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/tabs.ts`
- Validation checklist:
  - [ ] Tab create adds a tab with default pane.
  - [ ] Tab close terminates all panes' PTYs.
  - [ ] Tab switch updates active tab.
  - [ ] Tab events published.
- Edge cases:
  - Close the last tab: session may terminate; handle as session termination.
  - Switch to non-existent tab: reject with error.
  - Create tab with duplicate name: zellij may allow; track by position.

### Subtask T008 - Integrate pane operations with PTY lifecycle (spec 007)

- Purpose: ensure every pane has a backing PTY that follows PTY lifecycle rules.
- Steps:
  1. On pane create (T006), after the zellij pane is created:
     a. Spawn a PTY via `ptyManager.spawn({ laneId, sessionId, terminalId: paneId, cwd: worktreePath })`.
     b. Store the `ptyId` in the `PaneRecord`.
     c. Wire PTY output to the pane's zellij terminal input.
     d. Wire pane's user input to PTY write-input.
  2. On pane close (T006), before closing the zellij pane:
     a. Terminate the PTY via `ptyManager.terminate(ptyId)`.
     b. Wait for PTY termination to complete.
  3. On pane resize, relay dimensions to PTY via `ptyManager.resize(ptyId, cols, rows)`.
  4. Publish `mux.pane.pty_bound` event after PTY binding.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/panes.ts`
- Validation checklist:
  - [ ] Every pane has a PTY after creation.
  - [ ] PTY is terminated before pane close.
  - [ ] Resize propagates to PTY.
  - [ ] PTY binding event published.
- Edge cases:
  - PTY spawn fails after pane create: close the pane, report error.
  - PTY crashes while pane is open: publish error, offer pane re-spawn.
  - Pane close when PTY is already stopped: skip PTY termination.

### Subtask T009 - Implement minimum pane dimension enforcement

- Purpose: prevent unusable pane sizes that degrade UX or crash zellij.
- Steps:
  1. Define minimum dimensions: `MIN_PANE_COLS = 10`, `MIN_PANE_ROWS = 3` (configurable).
  2. Before any pane create or resize that would result in a pane below minimum:
     a. Calculate resulting dimensions of all affected panes.
     b. If any pane would violate minimums, reject the operation with `PaneTooSmallError`.
  3. For splits: calculate the resulting size of both the new pane and the existing pane.
  4. For resize: calculate the resulting size of the resized pane and its neighbor.
  5. Publish `mux.pane.dimension_rejected` event on rejection.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/panes.ts`
- Validation checklist:
  - [ ] Splits that would create too-small panes are rejected.
  - [ ] Resizes that would shrink below minimum are rejected.
  - [ ] Minimum dimensions are configurable.
  - [ ] Rejection event published.
- Edge cases:
  - Session window itself is smaller than 2x minimum: reject all splits.
  - Pane currently at minimum size: reject any shrink resize.

### Subtask T010 - Implement layout topology tracking [P]

- Purpose: maintain a queryable model of the current session layout.
- Steps:
  1. Define `LayoutTopology` type: `{ sessionName, tabs: TabTopology[], activeTabId }`.
     - `TabTopology`: `{ tabId, name, panes: PaneTopology[], layout: 'horizontal' | 'vertical' | 'stacked' }`.
     - `PaneTopology`: `{ paneId, ptyId, dimensions: { cols, rows }, focused: boolean }`.
  2. Maintain a `Map<sessionName, LayoutTopology>` in the adapter.
  3. Update topology after every pane/tab operation.
  4. Implement `getTopology(sessionName: string): LayoutTopology` for queries.
  5. Implement `refreshTopology(sessionName: string): Promise<LayoutTopology>` that queries zellij directly and rebuilds the topology from scratch.
  6. Topology refresh is used during reattach and reconciliation.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/panes.ts` (or new `topology.ts`)
- Validation checklist:
  - [ ] Topology reflects actual session layout after every operation.
  - [ ] `refreshTopology` rebuilds from zellij query output.
  - [ ] Topology includes dimensions, focus state, and PTY bindings.
  - [ ] Stale topology is detectable.
- Edge cases:
  - Zellij layout changed externally (user used zellij keybindings): detect drift on next refresh.
  - Session with no panes (shouldn't happen): handle gracefully.

## Test Strategy

- Unit test pane dimension enforcement with various split scenarios.
- Unit test topology tracking with mock pane/tab operations.
- Integration test: create panes and tabs in a real zellij session, verify layout.
- Integration test: verify PTY is spawned on pane create and terminated on close.

## Risks & Mitigations

- Risk: zellij pane/tab CLI output is unpredictable.
- Mitigation: parse defensively, refresh topology after operations.
- Risk: PTY binding adds latency to pane operations.
- Mitigation: PTY spawn is async; pane appears immediately, PTY binds shortly after.

## Review Guidance

- Validate PTY lifecycle integration: every pane has a PTY, every close terminates it.
- Validate dimension enforcement covers all split directions.
- Confirm topology tracking stays in sync with actual zellij state.
- Verify tab operations handle edge cases (last tab close, duplicate names).

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T12:14:53Z – claude-wp02-009 – shell_pid=65254 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:22:12Z – claude-wp02-009 – shell_pid=65254 – lane=planned – Moved to planned
- 2026-02-27T12:23:54Z – claude-wp02-009 – shell_pid=65254 – lane=planned – Agent failed, will retry
