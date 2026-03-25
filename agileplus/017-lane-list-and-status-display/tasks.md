# Work Packages: Lane Manager Panel

**Inputs**: Design documents from `/kitty-specs/017-lane-list-and-status-display/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 005, 008, 009, 015
**Tests**: Include explicit testing work because the feature spec requires real-time update verification and Playwright tests.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/017-lane-list-and-status-display/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Lane Panel Component, Status Badges, and State Mapping (Priority: P0)

**Phase**: Phase 1 - Panel Foundation
**Goal**: Implement the left-rail lane panel component, status badge system with color-coded indicators for all lane states, scrollable list with workspace grouping, and keyboard navigation.
**Independent Test**: Panel renders all lanes with correct status badges; badge colors match the lane state machine; keyboard navigation works; panel renders 50 lanes in under 300ms.
**Prompt**: `/kitty-specs/017-lane-list-and-status-display/tasks/WP01-lane-panel-and-status-badges.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Implement lane panel container with scrollable list and workspace grouping in `apps/desktop/src/panels/lane_panel.ts`
- [ ] T002 Implement status badge component with full state machine mapping in `apps/desktop/src/panels/status_badge.ts`
- [ ] T003 Implement lane list item component with badge, label, and action triggers in `apps/desktop/src/panels/lane_list_item.ts`
- [ ] T004 Implement keyboard navigation (arrow keys, Enter to attach) in `apps/desktop/src/panels/keyboard_nav.ts`
- [ ] T005 [P] Add unit tests for panel, badge, list item, and keyboard nav in `apps/desktop/tests/unit/panels/`

### Implementation Notes
- Status badge must map ALL lane states from spec 008: idle (gray), running (green), blocked (yellow), error (red), shared (blue), provisioning/cleaning (busy indicator), closed (removed or closed badge).
- Panel must support scrolling with sticky workspace grouping headers for large lane lists.
- Keyboard navigation must work within the lane list without conflicting with tab shortcuts.

### Parallel Opportunities
- T005 can proceed after T001-T004 interfaces are stable.

### Dependencies
- Depends on specs 005 (ID standards), 008 (lane lifecycle), 009 (session lifecycle), 015 (orphan detection).

### Risks & Mitigations
- Risk: large lane lists cause render performance issues.
- Mitigation: virtual scrolling for lists exceeding 50 items; benchmark at 50 lanes.

---

## Work Package WP02: CRUD Actions, Real-Time Updates, and Tests (Priority: P1)

**Phase**: Phase 2 - Interaction and Hardening
**Goal**: Implement lane CRUD actions (create, attach, detach, cleanup with confirmation), real-time status badge updates via bus event subscription, orphan flag integration, and comprehensive tests.
**Independent Test**: Lane actions execute successfully from the panel; badge updates reflect within 1 second of bus events; orphan flags display correctly; no cleanup without confirmation.
**Prompt**: `/kitty-specs/017-lane-list-and-status-display/tasks/WP02-crud-actions-and-realtime-updates.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T006 Implement lane action handlers (create, attach, detach, cleanup) in `apps/desktop/src/panels/lane_actions.ts`
- [ ] T007 Implement confirmation dialog for cleanup actions in `apps/desktop/src/panels/confirmation_dialog.ts`
- [ ] T008 Implement real-time bus event subscription for status badge updates in `apps/desktop/src/panels/lane_event_handler.ts`
- [ ] T009 Implement orphan detection integration: flag orphaned lanes with distinct visual indicator
- [ ] T010 Implement "status may be stale" indicator for bus connectivity issues
- [ ] T011 [P] Add Playwright end-to-end tests and performance benchmarks in `apps/desktop/tests/e2e/panels/`

### Implementation Notes
- Lane actions must trigger the corresponding runtime API calls (lane create, attach, detach, cleanup).
- Cleanup requires confirmation dialog before execution (FR-017-004).
- Real-time updates subscribe to lane state change events on the bus; updates must reflect within 1 second.
- Orphan integration queries spec 015 for flagged lanes and displays a distinct icon/badge.

### Parallel Opportunities
- T011 can proceed after T006-T010 are integrated.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: bus event floods cause excessive re-renders.
- Mitigation: batch updates with requestAnimationFrame debouncing.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 + WP02 (panel rendering + actions + real-time updates).

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Lane panel container with scroll + grouping | WP01 | P0 | No |
| T002 | Status badge with full state mapping | WP01 | P0 | No |
| T003 | Lane list item with badge + actions | WP01 | P0 | No |
| T004 | Keyboard navigation | WP01 | P0 | No |
| T005 | Panel unit tests | WP01 | P0 | Yes |
| T006 | Lane action handlers (CRUD) | WP02 | P1 | No |
| T007 | Cleanup confirmation dialog | WP02 | P1 | No |
| T008 | Real-time bus event subscription | WP02 | P1 | No |
| T009 | Orphan detection integration | WP02 | P1 | No |
| T010 | Stale-status indicator | WP02 | P1 | No |
| T011 | Playwright e2e tests + benchmarks | WP02 | P1 | Yes |
