---
work_package_id: WP04
title: Worktree Pooling, Reconciliation, and Tests
lane: "for_review"
dependencies:
- WP01
- WP02
- WP03
subtasks:
- T016
- T017
- T018
- T019
- T020
phase: Phase 4 - Hardening and Validation
assignee: 'claude-wp04-008'
agent: 'claude-wp04-008'
shell_pid: ''
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-02-27T20:00:00Z'
  lane: for_review
  agent: claude-wp04-008
  shell_pid: ''
  action: Implementation complete - all tests passing
---

# Work Package Prompt: WP04 - Worktree Pooling, Reconciliation, and Tests

## Objectives & Success Criteria

- Implement comprehensive orphaned lane reconciliation on startup.
- Build unit, integration, and stress tests for the full lane lifecycle.
- Validate zero-orphan guarantee in all test scenarios.

Success criteria:
- Startup reconciliation detects and cleans all orphaned worktrees and records within 30 seconds.
- Unit test coverage >= 85% on lane modules.
- Integration tests cover full create-run-cleanup cycle with real git repos.
- Stress test validates 50 concurrent lanes with zero leaks.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/spec.md` (FR-008-008, NFR-008-003, SC-008-002, SC-008-004)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/plan.md`

Constraints:
- Reconciliation timeout: 30 seconds.
- Concurrent lane limit: 50.
- Zero orphaned worktrees or par tasks after cleanup.

Implementation command:
- `spec-kitty implement WP04 --base WP03`

## Subtasks & Detailed Guidance

### Subtask T016 - Implement full orphaned lane reconciliation on startup

- Purpose: detect and clean up orphaned lanes from previous runtime sessions.
- Steps:
  1. On startup, run reconciliation before accepting new lane operations.
  2. Phase 1: Scan `.helios-worktrees/` directories and compare against lane registry.
     - Worktrees without registry entries: remove worktree and branch.
     - Registry entries without worktrees: transition to `closed` and remove.
  3. Phase 2: Scan for orphaned par processes using the par CLI (if par supports listing tasks) or process table scan.
     - Par processes without lane bindings: send SIGTERM, then SIGKILL after 10 seconds.
  4. Phase 3: Verify no orphaned PTYs exist for lanes that were cleaned up (delegate to spec 007 reconciliation).
  5. Publish `reconciliation.completed` event with counts: `{ orphanedWorktrees, orphanedRecords, orphanedParTasks, orphanedPtys, totalCleaned }`.
  6. Time-bound the entire reconciliation to 30 seconds; if exceeded, log warning and continue with partial cleanup.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/registry.ts`
- Validation checklist:
  - [ ] Orphaned worktrees detected and removed.
  - [ ] Orphaned records detected and closed.
  - [ ] Orphaned par tasks detected and killed.
  - [ ] Reconciliation completes within 30 seconds.
  - [ ] Summary event published.
- Edge cases:
  - No orphans at all: reconciliation is near-instant.
  - Many orphans (>20): parallelize cleanup to stay within timeout.
  - Reconciliation fails midway: publish partial results, log error.

### Subtask T017 - Add Vitest unit tests for lane state machine, registry, and worktree ops [P]

- Purpose: verify correctness of core lane infrastructure at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/lanes/`:
     - `state_machine.test.ts`: test every valid transition, every invalid transition, per-lane mutex serialization, transition history.
     - `registry.test.ts`: test register/get/update/remove, secondary indexes, capacity limits.
     - `worktree.test.ts`: test provisioning and cleanup with mocked git commands (use `vi.mock` to mock `Bun.spawn`).
     - `sharing.test.ts`: test multi-agent attach/detach, shared state transitions.
  2. Use Vitest fake timers for stale detection and escalation tests.
  3. Target >= 85% coverage on lane modules, >= 95% on state_machine.ts.
  4. Tag tests with FR/NFR IDs for traceability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/lanes/state_machine.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/lanes/registry.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/lanes/worktree.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/lanes/sharing.test.ts`
- Validation checklist:
  - [ ] All state transitions tested (valid and invalid).
  - [ ] Registry indexes verified after mutations.
  - [ ] Worktree ops tested with mocked git.
  - [ ] Sharing edge cases covered.
  - [ ] FR/NFR traceability tags present.

### Subtask T018 - Add integration tests for full lane lifecycle with real git repos [P]

- Purpose: verify end-to-end lane behavior with real git and par operations.
- Steps:
  1. Create `apps/runtime/tests/integration/lanes/lifecycle.test.ts`.
  2. Test setup: create a temporary git repo with initial commit.
  3. Test scenarios:
     a. Create a lane, verify worktree exists on disk, verify branch created, verify lane in `ready` state.
     b. Execute a command in the lane (e.g., `echo test > file.txt`), verify file exists in worktree.
     c. Cleanup the lane, verify worktree directory is gone, verify branch is deleted, verify lane record is removed.
     d. Create a lane, attach two agents (sharing), verify both can execute, detach both, verify lane returns to `ready`.
     e. Create a lane, force-exit the par task, verify stale detection fires.
  4. Each test cleans up all lanes and temporary repos.
  5. Tests must complete within 60 seconds total.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/lanes/lifecycle.test.ts`
- Validation checklist:
  - [ ] All five scenarios pass.
  - [ ] No orphaned worktrees or repos after suite.
  - [ ] Bus events verified for each transition.
  - [ ] Tests complete in < 60 seconds.

### Subtask T019 - Add integration test for orphan reconciliation scenario [P]

- Purpose: verify reconciliation handles real orphaned state.
- Steps:
  1. Create `apps/runtime/tests/integration/lanes/reconciliation.test.ts`.
  2. Test setup:
     a. Create a temporary git repo.
     b. Manually create a `.helios-worktrees/<fake-lane-id>/` directory (orphaned worktree).
     c. Manually create a lane record without a worktree (orphaned record).
  3. Run reconciliation.
  4. Verify:
     a. Orphaned worktree directory is removed.
     b. Orphaned record is closed/removed.
     c. Reconciliation summary event has correct counts.
     d. Reconciliation completes within 30 seconds.
  5. Clean up temporary repo.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/lanes/reconciliation.test.ts`
- Validation checklist:
  - [ ] Both orphan types detected and handled.
  - [ ] Summary event counts are correct.
  - [ ] No stale state after reconciliation.

### Subtask T020 - Add stress test for concurrent lane operations (50 lanes) [P]

- Purpose: validate the system supports 50 concurrent lanes per NFR-008-003.
- Steps:
  1. Create `apps/runtime/tests/integration/lanes/stress.test.ts`.
  2. Create a temporary git repo.
  3. Spawn 50 lanes concurrently using `Promise.all`.
  4. Verify all 50 lanes reach `ready` state.
  5. Execute a simple command in each lane concurrently.
  6. Clean up all 50 lanes concurrently.
  7. Verify:
     a. All 50 worktrees are removed.
     b. All 50 par tasks are terminated.
     c. All 50 lane records are removed.
     d. Zero orphaned worktrees remain.
  8. Measure total time for the 50-lane cycle.
  9. Test attempting lane 51 and verify capacity rejection.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/lanes/stress.test.ts`
- Validation checklist:
  - [ ] 50 lanes created, used, and cleaned up.
  - [ ] Zero orphans after cleanup.
  - [ ] Lane 51 rejected at capacity.
  - [ ] Total cycle time reported.

## Test Strategy

- Run `vitest run --coverage` targeting `apps/runtime/src/lanes/`.
- Enforce >= 85% line coverage overall.
- Integration and stress tests run as separate targets (not in default quick suite).
- All tests clean up temporary git repos and worktrees.

## Risks & Mitigations

- Risk: stress test is slow on CI (50 worktrees).
- Mitigation: use small repos (1 file each) and parallelize cleanup.
- Risk: flaky tests due to git timing.
- Mitigation: generous timeouts, deterministic lane IDs.

## Review Guidance

- Validate reconciliation handles both orphan directions.
- Validate stress test actually creates 50 real worktrees (not mocked).
- Confirm zero-orphan assertion after every test scenario.
- Verify test cleanup removes temporary repos.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
