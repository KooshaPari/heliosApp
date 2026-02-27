# Work Packages: Zellij Mux Session Adapter

**Inputs**: Design documents from `/kitty-specs/009-zellij-mux-session-adapter/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 001 (Control Plane), spec 002 (Local Bus), spec 007 (PTY Lifecycle), spec 008 (Par Lane Orchestrator)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/009-zellij-mux-session-adapter/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Zellij CLI Adapter and Session Lifecycle (Priority: P0 — prerequisite to all other WPs)

**Phase**: Phase 1 - Zellij Foundation
**Goal**: Deliver a zellij CLI wrapper, session create/reattach/terminate operations, and a session-to-lane binding registry.
**Independent Test**: Zellij sessions can be created, reattached after restart, and terminated with correct lane binding tracked throughout.
**Prompt**: `/kitty-specs/009-zellij-mux-session-adapter/tasks/WP01-zellij-cli-adapter-and-session-lifecycle.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [x] T001 Implement zellij CLI wrapper with version detection and availability check in `apps/runtime/src/integrations/zellij/cli.ts`
- [x] T002 Implement session create operation in `apps/runtime/src/integrations/zellij/session.ts`
- [x] T003 Implement session reattach operation using zellij native persistence
- [x] T004 Implement session terminate operation with graceful cleanup
- [x] T005 Implement session-to-lane binding registry in `apps/runtime/src/integrations/zellij/registry.ts`

### Implementation Notes
- All zellij operations use CLI shelling via `Bun.spawn`.
- Session names follow convention: `helios-lane-<laneId>`.
- Session create must verify zellij is installed before attempting.

### Parallel Opportunities
- T005 can proceed after T001 CLI wrapper is stable.

### Dependencies
- Depends on spec 008 (lane orchestrator) for lane identity.

### Risks & Mitigations
- Risk: zellij CLI interface changes between versions.
- Mitigation: version detection in T001, pin minimum version.

---

## Work Package WP02: Pane and Tab Topology with Session-to-Lane Binding (Priority: P1)

**Phase**: Phase 2 - Topology Management
**Goal**: Deliver pane and tab lifecycle operations (create, close, resize, switch) within mux sessions, with PTY lifecycle integration for pane-level terminal operations.
**Independent Test**: Panes and tabs can be created and managed within sessions, each pane is backed by a PTY, and topology events are published.
**Prompt**: `/kitty-specs/009-zellij-mux-session-adapter/tasks/WP02-pane-tab-topology-and-session-lane-binding.md`
**Estimated Prompt Size**: ~430 lines

### Included Subtasks
- [ ] T006 Implement pane create, close, and resize operations in `apps/runtime/src/integrations/zellij/panes.ts`
- [ ] T007 Implement tab create, close, and switch operations in `apps/runtime/src/integrations/zellij/tabs.ts`
- [ ] T008 Integrate pane operations with PTY lifecycle (spec 007): spawn PTY on pane create, terminate on close
- [ ] T009 Implement minimum pane dimension enforcement (FR-009-007)
- [ ] T010 [P] Implement layout topology tracking (current arrangement of tabs and panes with dimensions)

### Implementation Notes
- Pane create must trigger PTY spawn (spec 007) and bind PTY to the pane.
- Minimum pane dimensions: 10 cols x 3 rows (configurable).
- Tab operations use zellij CLI commands for tab management.

### Parallel Opportunities
- T010 can proceed after T006/T007 interfaces are defined.

### Dependencies
- Depends on WP01 and spec 007 (PTY Lifecycle).

### Risks & Mitigations
- Risk: zellij pane resize may not report new dimensions back.
- Mitigation: query zellij for pane dimensions after resize operations.

---

## Work Package WP03: Mux Event Relay, Reattach, and Tests (Priority: P1)

**Phase**: Phase 3 - Event Integration and Validation
**Goal**: Relay all mux-level events to the local bus, implement session reattach with topology recovery after runtime restart, reconcile orphaned sessions on startup, and build comprehensive tests.
**Independent Test**: Events are published for all session/pane/tab operations, reattach recovers topology, and orphaned sessions are cleaned up.
**Prompt**: `/kitty-specs/009-zellij-mux-session-adapter/tasks/WP03-mux-event-relay-reattach-and-tests.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T011 Implement mux event relay to local bus in `apps/runtime/src/integrations/zellij/events.ts`
- [ ] T012 Implement session reattach with pane topology recovery after restart
- [ ] T013 Implement orphaned session reconciliation on startup
- [ ] T014 [P] Add Vitest unit tests for CLI wrapper, session ops, pane/tab ops, and registry in `apps/runtime/tests/unit/zellij/`
- [ ] T015 [P] Add integration tests for full session-pane-tab lifecycle with real zellij in `apps/runtime/tests/integration/zellij/`
- [ ] T016 [P] Add reattach and reconciliation integration tests

### Implementation Notes
- Event types: session-created, pane-added, pane-closed, pane-resized, tab-created, tab-closed, tab-switched, session-terminated.
- Reattach uses `zellij attach <session-name>` and then queries pane layout to rebuild topology.
- Reconciliation compares live zellij sessions against the binding registry.

### Parallel Opportunities
- T014, T015, and T016 can all proceed in parallel once WP01 and WP02 interfaces are stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: zellij session state is opaque after restart.
- Mitigation: use `zellij list-sessions` and layout query commands to reconstruct state.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within WP03, all test subtasks run in parallel.
- **MVP Scope**: All three WPs are required for MVP mux session support.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Zellij CLI wrapper + version detection | WP01 | P0 | No |
| T002 | Session create | WP01 | P0 | No |
| T003 | Session reattach | WP01 | P0 | No |
| T004 | Session terminate | WP01 | P0 | No |
| T005 | Session-to-lane binding registry | WP01 | P0 | No |
| T006 | Pane create/close/resize | WP02 | P1 | No |
| T007 | Tab create/close/switch | WP02 | P1 | No |
| T008 | PTY integration for pane lifecycle | WP02 | P1 | No |
| T009 | Minimum pane dimension enforcement | WP02 | P1 | No |
| T010 | Layout topology tracking | WP02 | P1 | Yes |
| T011 | Mux event relay to local bus | WP03 | P1 | No |
| T012 | Session reattach with topology recovery | WP03 | P1 | No |
| T013 | Orphaned session reconciliation | WP03 | P1 | No |
| T014 | Unit tests for zellij adapter | WP03 | P1 | Yes |
| T015 | Integration tests for full lifecycle | WP03 | P1 | Yes |
| T016 | Reattach and reconciliation tests | WP03 | P1 | Yes |
