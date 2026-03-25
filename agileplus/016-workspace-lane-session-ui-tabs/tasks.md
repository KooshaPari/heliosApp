# Work Packages: Multi-Tab Navigation UI

**Inputs**: Design documents from `/kitty-specs/016-workspace-lane-session-ui-tabs/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 001, 003, 008, 009, 014
**Tests**: Include explicit testing work because the feature spec requires Playwright UI tests and keyboard navigation validation.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/016-workspace-lane-session-ui-tabs/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Active Context Store and Tab Surface Framework (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Implement the shared active context store holding the current (workspace_id, lane_id, session_id) triple, and the base tab surface framework with tab bar, selection, ordering, and persistence.
**Independent Test**: Context store publishes change events; tab bar renders with correct selection; tab selection and ordering persist across restarts.
**Prompt**: `/kitty-specs/016-workspace-lane-session-ui-tabs/tasks/WP01-active-context-store-and-tab-framework.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T001 Implement shared active context store with change events in `apps/desktop/src/tabs/context_switch.ts`
- [ ] T002 Implement base tab surface component with context binding in `apps/desktop/src/tabs/tab_surface.ts`
- [ ] T003 Implement tab bar component with selection, ordering, and reordering in `apps/desktop/src/tabs/tab_bar.ts`
- [ ] T004 Implement tab state persistence (selection, order, per-tab scroll) in `apps/desktop/src/tabs/tab_persistence.ts`
- [ ] T005 [P] Add unit tests for context store, tab bar, and persistence in `apps/desktop/tests/unit/tabs/`

### Implementation Notes
- Context store is the single source of truth for the active workspace/lane/session.
- Tab bar must support 5 tab types with consistent ordering.
- Persistence must survive runtime restarts and load within 100ms of startup.

### Parallel Opportunities
- T005 can proceed after T001-T004 interfaces are stable.

### Dependencies
- Depends on specs 001 (event bus), 003 (workspace identity), 008 (lane lifecycle), 009 (session lifecycle), 014 (terminal registry).

### Risks & Mitigations
- Risk: context store race conditions during rapid lane switches.
- Mitigation: single source of truth with explicit invalidation; latest-wins for rapid switches.

---

## Work Package WP02: Five Tab Implementations (Priority: P1)

**Phase**: Phase 2 - Tab Surfaces
**Goal**: Implement the five tab surfaces (terminal, agent, session, chat, project), each bound to the active context and rendering content appropriate to their purpose.
**Independent Test**: Each tab renders correctly for the active context; switching between tabs shows appropriate content; data source unavailability shows error state.
**Prompt**: `/kitty-specs/016-workspace-lane-session-ui-tabs/tasks/WP02-five-tab-implementations.md`
**Estimated Prompt Size**: ~450 lines

### Included Subtasks
- [ ] T006 Implement terminal tab surface in `apps/desktop/src/tabs/terminal_tab.ts`
- [ ] T007 Implement agent tab surface in `apps/desktop/src/tabs/agent_tab.ts`
- [ ] T008 Implement session tab surface in `apps/desktop/src/tabs/session_tab.ts`
- [ ] T009 Implement chat tab surface in `apps/desktop/src/tabs/chat_tab.ts`
- [ ] T010 Implement project tab surface in `apps/desktop/src/tabs/project_tab.ts`
- [ ] T011 [P] Add unit tests for each tab surface in `apps/desktop/tests/unit/tabs/`

### Implementation Notes
- Each tab subscribes to context change events and updates its content accordingly.
- Terminal tab integrates with the terminal registry (spec 014) to display the active terminal.
- All tabs must handle data source unavailability with an error state rather than crashing.

### Parallel Opportunities
- T006-T010 can proceed in parallel (independent tab implementations).
- T011 can proceed after tab interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: tab content loading blocks UI thread.
- Mitigation: async data fetching with loading indicators; never block render.

---

## Work Package WP03: Context Switch Propagation, Keyboard Shortcuts, and End-to-End Tests (Priority: P1)

**Phase**: Phase 3 - Integration and Hardening
**Goal**: Implement atomic context switch propagation to all visible tabs, configurable keyboard shortcuts, stale-context indicators, and comprehensive Playwright end-to-end tests.
**Independent Test**: Context switch updates all tabs within 500ms; keyboard shortcuts navigate all tabs; stale-context indicator appears on failed tab update; zero mixed-context state across tabs.
**Prompt**: `/kitty-specs/016-workspace-lane-session-ui-tabs/tasks/WP03-context-switch-propagation-and-keyboard-shortcuts.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T012 Implement atomic context switch propagation to all visible tabs with stale-context fallback
- [ ] T013 Implement configurable keyboard shortcuts for tab switching in `apps/desktop/src/tabs/keyboard_shortcuts.ts`
- [ ] T014 Implement stale-context indicator component for tabs that fail to update
- [ ] T015 [P] Add Playwright end-to-end tests for tab navigation, context switching, and keyboard workflows in `apps/desktop/tests/e2e/tabs/`
- [ ] T016 [P] Add performance benchmarks for tab switch latency and context propagation in `apps/desktop/tests/e2e/tabs/`

### Implementation Notes
- Atomic propagation: either all tabs update or stale indicators appear on failed ones.
- Keyboard shortcuts must be configurable and persist as user preferences.
- No mouse-required workflows; all tab actions must be keyboard-accessible.

### Parallel Opportunities
- T015 and T016 can proceed in parallel after T012-T014 are integrated.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: rapid context switches cause intermediate flicker.
- Mitigation: debounce propagation; converge on final context without rendering intermediate states.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within WP02, all five tab implementations (T006-T010) can proceed in parallel. Within each WP, `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 + WP02 + WP03 (all required for functional tab navigation).

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Active context store with change events | WP01 | P0 | No |
| T002 | Base tab surface with context binding | WP01 | P0 | No |
| T003 | Tab bar with selection and ordering | WP01 | P0 | No |
| T004 | Tab state persistence | WP01 | P0 | No |
| T005 | Context store and tab bar unit tests | WP01 | P0 | Yes |
| T006 | Terminal tab surface | WP02 | P1 | No |
| T007 | Agent tab surface | WP02 | P1 | No |
| T008 | Session tab surface | WP02 | P1 | No |
| T009 | Chat tab surface | WP02 | P1 | No |
| T010 | Project tab surface | WP02 | P1 | No |
| T011 | Tab surface unit tests | WP02 | P1 | Yes |
| T012 | Atomic context switch propagation | WP03 | P1 | No |
| T013 | Configurable keyboard shortcuts | WP03 | P1 | No |
| T014 | Stale-context indicator | WP03 | P1 | No |
| T015 | Playwright end-to-end tests | WP03 | P1 | Yes |
| T016 | Performance benchmarks | WP03 | P1 | Yes |
