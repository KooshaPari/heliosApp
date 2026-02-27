# Work Packages: Par Lane Orchestrator Integration

**Inputs**: Design documents from `/kitty-specs/008-par-lane-orchestrator-integration/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 001 (Control Plane), spec 002 (Local Bus), spec 005 (ID Standards), spec 007 (PTY Lifecycle)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/008-par-lane-orchestrator-integration/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Lane State Machine and Lifecycle Commands (Priority: P0 — prerequisite to all other WPs)

**Phase**: Phase 1 - Lane Infrastructure
**Goal**: Deliver the lane state machine (new -> provisioning -> ready -> running -> blocked -> shared -> cleaning -> closed), in-memory lane registry, and core lifecycle commands (create, attach, detach, cleanup).
**Independent Test**: Lanes can be created, transition through states deterministically, and cleanup leaves no orphaned records.
**Prompt**: `/kitty-specs/008-par-lane-orchestrator-integration/tasks/WP01-lane-state-machine-and-lifecycle-commands.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [x] T001 Implement lane state machine with validated transitions in `apps/runtime/src/lanes/state_machine.ts`
- [x] T002 Implement in-memory lane registry with secondary indexes in `apps/runtime/src/lanes/registry.ts`
- [x] T003 Implement lane lifecycle commands (create, list, attach, detach, cleanup) in `apps/runtime/src/lanes/index.ts`
- [x] T004 [P] Wire lane lifecycle event publishing to local bus
- [x] T005 [P] Implement lane sharing (multi-agent concurrent access) in `apps/runtime/src/lanes/sharing.ts`

### Implementation Notes
- State transitions must be serialized per lane to prevent race conditions (NFR-008-004).
- Cross-lane operations must remain independent.
- Lane cleanup must be idempotent.

### Parallel Opportunities
- T004 and T005 can proceed after T001/T002 interfaces are stable.

### Dependencies
- Depends on spec 005 (ID Standards) for lane ID generation.

### Risks & Mitigations
- Risk: per-lane serialization introduces deadlocks.
- Mitigation: use per-lane async mutex, never hold multiple lane locks.

---

## Work Package WP02: Git Worktree Provisioning and Cleanup (Priority: P1)

**Phase**: Phase 2 - Worktree Management
**Goal**: Provision git worktrees for each lane during the `provisioning` phase and clean them up during the `cleaning` phase. Handle partial provisioning failures and orphaned worktrees.
**Independent Test**: Lane creation provisions a real git worktree, cleanup removes it, and orphaned worktrees are reconciled on startup.
**Prompt**: `/kitty-specs/008-par-lane-orchestrator-integration/tasks/WP02-git-worktree-provisioning-and-cleanup.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [x] T006 Implement git worktree provisioning (create worktree from workspace repo) in `apps/runtime/src/lanes/worktree.ts`
- [x] T007 Implement git worktree cleanup (remove worktree, prune) in `apps/runtime/src/lanes/worktree.ts`
- [x] T008 Implement graceful PTY termination before worktree removal (via spec 007) in `apps/runtime/src/lanes/index.ts`
- [x] T009 [P] Implement orphaned worktree detection and reconciliation on startup
- [x] T010 [P] Handle partial provisioning failures with automatic cleanup

### Implementation Notes
- Worktree paths: `<workspace-root>/.helios-worktrees/<lane-id>/`.
- Git commands via `Bun.spawn` calling the git CLI.
- Provisioning failure must clean up partial worktrees before transitioning to `closed`.

### Parallel Opportunities
- T009 and T010 can proceed after T006/T007 core worktree ops are stable.

### Dependencies
- Depends on WP01 (lane state machine) and spec 007 (PTY lifecycle for T008).

### Risks & Mitigations
- Risk: git worktree operations fail on repositories with submodules.
- Mitigation: test with submodule repos, handle `git worktree add` failures gracefully.

---

## Work Package WP03: Par Task Binding and Lane Events (Priority: P1)

**Phase**: Phase 3 - Execution Isolation
**Goal**: Bind par tasks to lanes for execution isolation and lifecycle tracking. Par tasks run commands within the lane's worktree context. Publish lane lifecycle events for all state transitions.
**Independent Test**: A par task is bound to a lane, commands execute within the worktree, and all transitions publish events with correct correlation.
**Prompt**: `/kitty-specs/008-par-lane-orchestrator-integration/tasks/WP03-par-task-binding-and-lane-events.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T011 Implement par task binding (spawn par task, associate with lane) in `apps/runtime/src/lanes/par.ts`
- [ ] T012 Implement par task termination during lane cleanup in `apps/runtime/src/lanes/par.ts`
- [ ] T013 Implement command execution within lane worktree context via par
- [ ] T014 [P] Implement stale par task detection and force-kill escalation
- [ ] T015 [P] Wire comprehensive lane lifecycle events for all state transitions

### Implementation Notes
- Par is invoked via `Bun.spawn` calling the par CLI.
- Par task binding must track the par process PID for cleanup.
- Stale par task detection: if no heartbeat within configurable timeout, escalate to force-kill.

### Parallel Opportunities
- T014 and T015 can proceed after T011 binding interface is stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: par task becomes unresponsive and blocks lane cleanup.
- Mitigation: force-kill with SIGKILL after configurable timeout (default 10 seconds).

---

## Work Package WP04: Worktree Pooling, Reconciliation, and Tests (Priority: P2)

**Phase**: Phase 4 - Hardening and Validation
**Goal**: Implement orphaned lane reconciliation on startup, validate zero-orphan cleanup in all scenarios, and build comprehensive tests for the full lane create-run-cleanup lifecycle.
**Independent Test**: Startup reconciliation cleans up all orphans, and the full test suite passes with zero orphaned worktrees or par tasks.
**Prompt**: `/kitty-specs/008-par-lane-orchestrator-integration/tasks/WP04-worktree-pooling-reconciliation-and-tests.md`
**Estimated Prompt Size**: ~370 lines

### Included Subtasks
- [ ] T016 Implement full orphaned lane reconciliation on startup (worktrees without records, records without worktrees) in `apps/runtime/src/lanes/registry.ts`
- [ ] T017 [P] Add Vitest unit tests for lane state machine, registry, and worktree ops in `apps/runtime/tests/unit/lanes/`
- [ ] T018 [P] Add integration tests for full lane create-run-cleanup lifecycle with real git repos in `apps/runtime/tests/integration/lanes/`
- [ ] T019 [P] Add integration test for orphan reconciliation scenario
- [ ] T020 [P] Add stress test for concurrent lane operations (50 lanes) validating NFR-008-003

### Implementation Notes
- Reconciliation must complete within 30 seconds (SC-008-004).
- Stress test must verify zero leaked worktrees after all lanes close.

### Parallel Opportunities
- All test subtasks (T017-T020) can proceed in parallel after WP01-WP03 interfaces are stable.

### Dependencies
- Depends on WP01, WP02, and WP03.

### Risks & Mitigations
- Risk: concurrent lane stress test is flaky.
- Mitigation: use deterministic lane IDs and generous timeouts.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> (WP02 and WP03 in parallel) -> WP04.
- **Parallelization**: WP02 and WP03 can run concurrently after WP01. Within WP04, all test subtasks run in parallel.
- **MVP Scope**: All four WPs are required for MVP lane orchestration.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Lane state machine with validated transitions | WP01 | P0 | No |
| T002 | In-memory lane registry | WP01 | P0 | No |
| T003 | Lane lifecycle commands | WP01 | P0 | No |
| T004 | Lane event publishing to bus | WP01 | P0 | Yes |
| T005 | Lane sharing (multi-agent) | WP01 | P0 | Yes |
| T006 | Git worktree provisioning | WP02 | P1 | No |
| T007 | Git worktree cleanup | WP02 | P1 | No |
| T008 | Graceful PTY termination before worktree removal | WP02 | P1 | No |
| T009 | Orphaned worktree detection | WP02 | P1 | Yes |
| T010 | Partial provisioning failure handling | WP02 | P1 | Yes |
| T011 | Par task binding | WP03 | P1 | No |
| T012 | Par task termination during cleanup | WP03 | P1 | No |
| T013 | Command execution via par in worktree | WP03 | P1 | No |
| T014 | Stale par task detection + force-kill | WP03 | P1 | Yes |
| T015 | Comprehensive lane lifecycle events | WP03 | P1 | Yes |
| T016 | Full orphaned lane reconciliation | WP04 | P2 | No |
| T017 | Unit tests for state machine/registry/worktree | WP04 | P2 | Yes |
| T018 | Integration tests for full lifecycle | WP04 | P2 | Yes |
| T019 | Orphan reconciliation integration test | WP04 | P2 | Yes |
| T020 | Concurrent lane stress test (50 lanes) | WP04 | P2 | Yes |
