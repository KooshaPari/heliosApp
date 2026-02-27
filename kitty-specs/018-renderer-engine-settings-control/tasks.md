# Work Packages: Renderer Engine Settings Control

**Inputs**: Design documents from `/kitty-specs/018-renderer-engine-settings-control/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 004, 010, 013
**Tests**: Include explicit testing work because the feature spec requires Playwright UI tests and persistence validation.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/018-renderer-engine-settings-control/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Settings Panel, Capability Display, and Switch Trigger (Priority: P0)

**Phase**: Phase 1 - Settings Foundation
**Goal**: Implement the renderer settings panel section listing ghostty and rio with availability status, capability display (version, hot-swap support, features), confirmation dialog for switch trigger, and preference persistence.
**Independent Test**: Settings panel renders both renderers with correct capabilities; switch trigger shows confirmation; preferences persist across restarts; panel renders in under 200ms.
**Prompt**: `/kitty-specs/018-renderer-engine-settings-control/tasks/WP01-settings-panel-and-capability-display.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Implement renderer settings section container in `apps/desktop/src/settings/renderer_settings.ts`
- [ ] T002 Implement renderer option component with availability status in `apps/desktop/src/settings/renderer_option.ts`
- [ ] T003 Implement capability display expansion panel in `apps/desktop/src/settings/capability_display.ts`
- [ ] T004 Implement switch confirmation dialog and trigger in `apps/desktop/src/settings/switch_confirmation.ts`
- [ ] T005 Implement renderer preference persistence in `apps/desktop/src/settings/renderer_preferences.ts`
- [ ] T006 [P] Add unit tests for settings panel, capability display, and preferences in `apps/desktop/tests/unit/settings/`

### Implementation Notes
- Renderer option must display availability from feature flags (spec 004) and capabilities from spec 010.
- Confirmation dialog must clearly state whether hot-swap or restart-with-restore will be used.
- Preferences default to ghostty with hot-swap enabled (FR-018-007, edge case).

### Parallel Opportunities
- T006 can proceed after T001-T005 interfaces are stable.

### Dependencies
- Depends on specs 004 (feature flags), 010 (renderer capabilities), 013 (switch transaction).

### Risks & Mitigations
- Risk: capability data unavailable at render time.
- Mitigation: display loading state with graceful fallback for unavailable capabilities.

---

## Work Package WP02: Hot-Swap Toggle, Status Indicators, and Tests (Priority: P1)

**Phase**: Phase 2 - Interaction and Hardening
**Goal**: Implement the hot-swap preference toggle, real-time switch status indicators, settings lock during active transactions, and comprehensive Playwright tests.
**Independent Test**: Hot-swap toggle persists and affects switch behavior; status indicators update in real time during transactions; settings are locked during active switches; all Playwright tests pass.
**Prompt**: `/kitty-specs/018-renderer-engine-settings-control/tasks/WP02-hotswap-toggle-and-status-indicators.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T007 Implement hot-swap preference toggle in `apps/desktop/src/settings/hotswap_toggle.ts`
- [ ] T008 Implement real-time switch status indicator in `apps/desktop/src/settings/switch_status.ts`
- [ ] T009 Implement settings lock during active transactions in `apps/desktop/src/settings/settings_lock.ts`
- [ ] T010 Wire hot-swap preference into switch transaction trigger (spec 013 integration)
- [ ] T011 [P] Add Playwright end-to-end tests and performance benchmarks in `apps/desktop/tests/e2e/settings/`

### Implementation Notes
- Hot-swap toggle must affect which switch path is used (FR-018-006): when disabled, always use restart-with-restore.
- Status indicators subscribe to switch transaction events on the bus (spec 013).
- Settings lock prevents renderer selection changes during an active transaction (FR-018-008).

### Parallel Opportunities
- T011 can proceed after T007-T010 are integrated.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: status indicator out of sync with actual transaction state.
- Mitigation: subscribe to all transaction phase events; timeout to "unknown" state if events stop.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 + WP02 (settings panel + toggle + status + tests).

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Renderer settings section container | WP01 | P0 | No |
| T002 | Renderer option with availability | WP01 | P0 | No |
| T003 | Capability display expansion panel | WP01 | P0 | No |
| T004 | Switch confirmation dialog + trigger | WP01 | P0 | No |
| T005 | Renderer preference persistence | WP01 | P0 | No |
| T006 | Settings panel unit tests | WP01 | P0 | Yes |
| T007 | Hot-swap preference toggle | WP02 | P1 | No |
| T008 | Real-time switch status indicator | WP02 | P1 | No |
| T009 | Settings lock during transactions | WP02 | P1 | No |
| T010 | Hot-swap preference wiring to spec 013 | WP02 | P1 | No |
| T011 | Playwright e2e tests + benchmarks | WP02 | P1 | Yes |
