# Work Packages: App Settings and Feature Flags

**Inputs**: Design documents from `/kitty-specs/004-app-settings-and-feature-flags/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the feature spec requires schema validation, hot-reload propagation, and zero-allocation flag reads.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/004-app-settings-and-feature-flags/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Settings Schema, Persistence, and Hot-Reload (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Implement typed settings schema with defaults, JSON persistence, validation, hot-reload propagation via bus events, and restart-required indicator.
**Independent Test**: Fresh install returns defaults; invalid values rejected; hot-reload reaches subscribers within 500ms; settings survive restart.
**Prompt**: `/kitty-specs/004-app-settings-and-feature-flags/tasks/WP01-settings-schema-persistence-and-hot-reload.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [x] T001 Define settings types, schema definition format, and reload policy in `apps/runtime/src/config/types.ts`
- [x] T002 Implement settings schema with defaults and validation rules in `apps/runtime/src/config/schema.ts`
- [x] T003 Implement JSON persistence store with in-memory cache and file watch in `apps/runtime/src/config/store.ts`
- [x] T004 Implement settings read/write API with validation and change detection in `apps/runtime/src/config/settings.ts`
- [x] T005 Implement hot-reload propagation via bus events and restart-required indicator in `apps/runtime/src/config/settings.ts`
- [x] T006 [P] Implement unknown key preservation for forward compatibility in `apps/runtime/src/config/store.ts`
- [x] T007 [P] Add Vitest unit tests for schema, validation, persistence, and hot-reload in `apps/runtime/tests/unit/config/`

### Implementation Notes
- Settings schema defines: key, type, default, validation rule, reload policy (hot/restart).
- JSON file in app data directory (same pattern as spec 003).
- Hot-reload: `settings.changed` bus event with key, oldValue, newValue.
- Restart-required: persist change, set flag, do not emit hot-reload event.
- Unknown keys preserved on save (round-trip fidelity).

### Parallel Opportunities
- T006 and T007 can proceed once T004 API surface is stable.

### Dependencies
- None (bus events use spec 002; stub if not available).

### Risks & Mitigations
- Risk: file watch races with write operations.
- Mitigation: debounce file watch events; ignore events triggered by own writes.

---

## Work Package WP02: Feature Flag System and Tests (Priority: P1)

**Phase**: Phase 2 - Feature Gating
**Goal**: Implement feature flag subsystem with typed queries, zero-allocation read path, `renderer_engine` flag, and comprehensive tests including microbenchmarks.
**Independent Test**: Feature flag reads return correct values with < 0.01ms latency; flag changes emit bus events; concurrent access is safe.
**Prompt**: `/kitty-specs/004-app-settings-and-feature-flags/tasks/WP02-feature-flag-system-and-tests.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [ ] T008 Implement feature flag subsystem with typed query API in `apps/runtime/src/config/flags.ts`
- [ ] T009 Define `renderer_engine` feature flag with `ghostty` (default) and `rio` values in `apps/runtime/src/config/schema.ts`
- [ ] T010 Wire feature flag changes to bus events and settings persistence in `apps/runtime/src/config/flags.ts`
- [ ] T011 [P] Add Vitest unit tests for flag reads, flag changes, and edge cases in `apps/runtime/tests/unit/config/`
- [ ] T012 [P] Add microbenchmarks for flag read latency (<0.01ms) and settings write (<50ms) in `apps/runtime/tests/bench/config/`

### Implementation Notes
- Feature flags are a specialized settings view with typed enum values.
- Zero-allocation read path: pre-cache flag values in primitive form (no object creation on read).
- `renderer_engine`: type=enum, values=['ghostty', 'rio'], default='ghostty', reload_policy='restart'.
- Flag changes go through the same settings validation and persistence pipeline.

### Parallel Opportunities
- T011 and T012 can proceed once T008/T009 API is stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: flag read path allocates on hot path.
- Mitigation: microbenchmark gate enforces < 0.01ms; use cached primitive values, not Map lookups.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 is P0; WP02 is P1 but required for dual-renderer support.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Settings types and reload policy | WP01 | P0 | No |
| T002 | Settings schema with defaults | WP01 | P0 | No |
| T003 | JSON persistence store | WP01 | P0 | No |
| T004 | Settings read/write API | WP01 | P0 | No |
| T005 | Hot-reload via bus events | WP01 | P0 | No |
| T006 | Unknown key preservation | WP01 | P0 | Yes |
| T007 | Settings unit tests | WP01 | P0 | Yes |
| T008 | Feature flag subsystem | WP02 | P1 | No |
| T009 | renderer_engine flag definition | WP02 | P1 | No |
| T010 | Flag change bus events | WP02 | P1 | No |
| T011 | Feature flag unit tests | WP02 | P1 | Yes |
| T012 | Flag read microbenchmarks | WP02 | P1 | Yes |
