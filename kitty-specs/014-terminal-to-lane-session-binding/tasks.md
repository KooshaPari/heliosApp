# Work Packages: Terminal Registry and Context Binding

**Inputs**: Design documents from `/kitty-specs/014-terminal-to-lane-session-binding/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 001, 003, 005, 007, 008, 009
**Tests**: Include explicit testing work because the feature spec requires consistency invariants and persistence validation.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/014-terminal-to-lane-session-binding/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Terminal Registry, Binding CRUD, and Validation Middleware (Priority: P0)

**Phase**: Phase 1 - Registry Foundation
**Goal**: Implement the terminal registry with CRUD operations, multi-key indexing, binding triple validation, and pre-operation validation middleware.
**Independent Test**: Registry enforces uniqueness, rejects unbound terminals, validates bindings before operations, and supports lookups by any key in under 2ms.
**Prompt**: `/kitty-specs/014-terminal-to-lane-session-binding/tasks/WP01-terminal-registry-and-binding-crud.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Implement binding triple type definitions and validation in `apps/runtime/src/registry/binding_triple.ts`
- [ ] T002 Implement terminal registry with CRUD and multi-key indexing in `apps/runtime/src/registry/terminal_registry.ts`
- [ ] T003 Implement pre-operation binding validation middleware in `apps/runtime/src/registry/binding_middleware.ts`
- [ ] T004 [P] Add unit and property-based tests for registry CRUD, uniqueness, and validation in `apps/runtime/tests/unit/registry/`

### Implementation Notes
- Registry must enforce: no duplicate terminal_ids, no unbound terminals, valid lane/session references.
- Multi-key indexing: lookups by terminal_id, lane_id, session_id, or workspace_id.
- Validation middleware intercepts terminal operations and rejects those with stale/invalid bindings.

### Parallel Opportunities
- T004 can proceed after T001/T002/T003 interfaces are stable.

### Dependencies
- Depends on specs 001 (event bus), 003 (workspace identity), 005 (ID standards), 007 (PTY lifecycle), 008 (lane lifecycle), 009 (session lifecycle).

### Risks & Mitigations
- Risk: multi-key index adds memory overhead.
- Mitigation: use lightweight index maps; 1000 bindings is a small dataset.

---

## Work Package WP02: Lifecycle Event Emission, Persistence, and Integration Tests (Priority: P1)

**Phase**: Phase 2 - Durability and Integration
**Goal**: Implement binding lifecycle event emission, durable persistence for restart recovery, integration with lane/session lifecycle events for automatic binding invalidation, and comprehensive tests.
**Independent Test**: Binding events fire on all state changes; bindings survive restart; lane/session cleanup invalidates affected bindings; latency benchmarks pass.
**Prompt**: `/kitty-specs/014-terminal-to-lane-session-binding/tasks/WP02-lifecycle-events-persistence-and-tests.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T005 Implement binding lifecycle event emission (bound, rebound, unbound, validation-failed) in `apps/runtime/src/registry/binding_events.ts`
- [ ] T006 Implement durable persistence adapter for binding state in `apps/runtime/src/registry/persistence.ts`
- [ ] T007 Implement lane/session lifecycle event subscription for automatic binding invalidation
- [ ] T008 [P] Add integration tests for persistence, restart recovery, lifecycle event propagation, and latency benchmarks in `apps/runtime/tests/integration/registry/`

### Implementation Notes
- Persistence must be file-backed or embedded SQLite for restart survival.
- Lane detach/cleanup events must trigger binding invalidation or terminal closure.
- Latency benchmarks must verify <5ms validation overhead and <2ms lookup at p95 with 500+ bindings.

### Parallel Opportunities
- T008 can proceed after T005/T006/T007 interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: persistence write overhead on every binding change.
- Mitigation: batch writes with in-memory index as primary; persist asynchronously.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 (registry, CRUD, validation) + WP02 (events, persistence, tests).

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Binding triple type definitions and validation | WP01 | P0 | No |
| T002 | Terminal registry with CRUD and multi-key indexing | WP01 | P0 | No |
| T003 | Pre-operation binding validation middleware | WP01 | P0 | No |
| T004 | Registry unit and property-based tests | WP01 | P0 | Yes |
| T005 | Binding lifecycle event emission | WP02 | P1 | No |
| T006 | Durable persistence adapter | WP02 | P1 | No |
| T007 | Lane/session lifecycle subscription for invalidation | WP02 | P1 | No |
| T008 | Integration tests and latency benchmarks | WP02 | P1 | Yes |
