---
work_package_id: WP02
title: Git Worktree Provisioning and Cleanup
lane: "doing"
dependencies:
- WP01
base_branch: 008-par-lane-orchestrator-integration-WP01
base_commit: 1d0b8b91af3e44d3e5ff2f42ccf80d747e8e079e
created_at: '2026-02-27T12:14:48.875991+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 2 - Worktree Management
assignee: ''
agent: ''
shell_pid: "64845"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Git Worktree Provisioning and Cleanup

## Objectives & Success Criteria

- Provision git worktrees for lanes during the `provisioning` phase.
- Clean up worktrees during the `cleaning` phase with graceful PTY termination first.
- Detect and reconcile orphaned worktrees on startup.
- Handle partial provisioning failures with automatic cleanup.

Success criteria:
- Worktree provisioning completes in p95 < 5 seconds for repos < 1 GB (NFR-008-001).
- Cleanup completes in p95 < 10 seconds (NFR-008-002).
- Zero orphaned worktrees after cleanup in all scenarios.
- Partial provisioning failures leave no stale worktree directories.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/spec.md` (FR-008-002, FR-008-005, FR-008-006, FR-008-008)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/plan.md`
- Spec 007 (PTY Lifecycle) for graceful terminal teardown

Constraints:
- Git CLI called via `Bun.spawn`; no git library dependency.
- Worktree path convention: `<workspace-root>/.helios-worktrees/<lane-id>/`.
- PTY termination (spec 007) must complete before worktree directory removal.

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement git worktree provisioning

- Purpose: create isolated git worktrees for lane execution contexts.
- Steps:
  1. Implement `provisionWorktree(options: WorktreeOptions): Promise<WorktreeResult>` in `apps/runtime/src/lanes/worktree.ts`:
     - `WorktreeOptions`: `{ workspaceRepoPath: string, laneId: string, baseBranch: string }`.
     - `WorktreeResult`: `{ worktreePath: string, branchName: string, createdAt: Date }`.
  2. Compute worktree path: `path.join(workspaceRepoPath, '.helios-worktrees', laneId)`.
  3. Compute branch name: `helios/lane/<laneId>`.
  4. Execute `git worktree add -b <branchName> <worktreePath> <baseBranch>` via `Bun.spawn`.
  5. Capture git command stdout/stderr for diagnostics.
  6. Verify the worktree directory exists after creation.
  7. Measure provisioning latency for NFR-008-001 compliance.
  8. On success, update lane record with `worktreePath` and transition to `ready`.
  9. On failure, throw `WorktreeProvisionError` with git stderr output.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/worktree.ts`
- Validation checklist:
  - [ ] Worktree directory is created at expected path.
  - [ ] Branch is created with correct base.
  - [ ] Git command errors are captured with stderr.
  - [ ] Provisioning latency is measured.
  - [ ] Lane record is updated with worktreePath.
- Edge cases:
  - Worktree path already exists (stale from previous crash): remove before creating.
  - baseBranch does not exist: fail with clear error.
  - Repository has submodules: test that worktree includes submodule content.
  - Disk space exhaustion during worktree creation: fail cleanly.

### Subtask T007 - Implement git worktree cleanup

- Purpose: remove worktrees and prune git references when lanes are closed.
- Steps:
  1. Implement `removeWorktree(worktreePath: string, workspaceRepoPath: string): Promise<void>` in `apps/runtime/src/lanes/worktree.ts`.
  2. Execute `git worktree remove <worktreePath> --force` via `Bun.spawn`.
  3. If the worktree directory still exists after removal, force-delete with `rm -rf` as fallback.
  4. Execute `git worktree prune` to clean up stale references.
  5. Delete the lane branch: `git branch -D <branchName>`.
  6. Verify the worktree directory no longer exists.
  7. Measure cleanup latency for NFR-008-002 compliance.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/worktree.ts`
- Validation checklist:
  - [ ] Worktree directory is fully removed.
  - [ ] Git references are pruned.
  - [ ] Lane branch is deleted.
  - [ ] Cleanup latency is measured.
  - [ ] Force-delete fallback handles locked files.
- Edge cases:
  - Worktree already removed (idempotent cleanup): no error.
  - Git worktree remove fails with locked files: fallback to rm -rf.
  - Branch deletion fails because branch was manually deleted: log warning, continue.

### Subtask T008 - Implement graceful PTY termination before worktree removal

- Purpose: ensure running processes are stopped before their working directory is deleted.
- Steps:
  1. During lane cleanup, before calling `removeWorktree`, query the PTY manager (spec 007) for all PTYs in the lane: `ptyManager.getByLane(laneId)`.
  2. For each active PTY, call `ptyManager.terminate(ptyId)` with the standard grace period.
  3. Wait for all PTY terminations to complete (use `Promise.all` with a timeout).
  4. If any PTY termination times out, log a warning and force-kill.
  5. Only proceed to worktree removal after all PTYs are stopped.
  6. Publish `lane.ptys_terminated` event with count and any force-kill indicators.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/index.ts` (cleanup method)
- Validation checklist:
  - [ ] All lane PTYs are terminated before worktree removal.
  - [ ] PTY termination timeout triggers force-kill.
  - [ ] Event published with termination stats.
  - [ ] Worktree removal only starts after PTYs are stopped.
- Edge cases:
  - Lane has no PTYs: skip termination, proceed to worktree removal.
  - PTY in `errored` state: still attempt terminate for cleanup.
  - PTY manager unavailable: log error, proceed with worktree removal anyway (best effort).

### Subtask T009 - Implement orphaned worktree detection and reconciliation on startup [P]

- Purpose: clean up worktrees that survive crashes and have no matching lane records.
- Steps:
  1. On startup, scan `<workspace-root>/.helios-worktrees/` for directories.
  2. For each directory, extract the lane ID from the directory name.
  3. Check if a corresponding lane record exists in the registry.
  4. If no record exists, the worktree is orphaned:
     a. Attempt to terminate any running processes in the worktree.
     b. Remove the worktree using `removeWorktree`.
     c. Log the orphan cleanup.
  5. Also check for lane records without worktrees: update their state to `closed`.
  6. Publish reconciliation summary: `{ orphanedWorktrees, orphanedRecords, cleaned }`.
  7. Complete within 30 seconds (SC-008-004).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/registry.ts` (or new reconciliation module)
- Validation checklist:
  - [ ] Orphaned directories are detected and removed.
  - [ ] Orphaned records are detected and closed.
  - [ ] Reconciliation completes within 30 seconds.
  - [ ] Summary event published.
- Edge cases:
  - No orphans: reconciliation is instant.
  - Workspace root does not exist: skip scan, no error.
  - Permissions error on directory scan: log warning, continue with partial results.

### Subtask T010 - Handle partial provisioning failures with automatic cleanup [P]

- Purpose: ensure failed provisioning never leaves stale state.
- Steps:
  1. Wrap the provisioning flow in a try/catch.
  2. On any failure during provisioning:
     a. If the worktree directory was partially created, remove it.
     b. If the branch was partially created, delete it.
     c. Remove the lane record from the registry.
     d. Transition the lane to `closed` via the state machine.
     e. Publish a `lane.provision_failed` event with error details.
  3. Test with failures at each step of provisioning to verify cleanup completeness.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/worktree.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/index.ts`
- Validation checklist:
  - [ ] No stale worktree directories after provisioning failure.
  - [ ] No stale git branches after failure.
  - [ ] Lane record is removed or closed.
  - [ ] Failure event published with error details.
- Edge cases:
  - Cleanup itself fails (e.g., disk error during rm): log error, mark lane as needing manual cleanup.
  - Failure at the very first step (lane ID generation): nothing to clean up.

## Test Strategy

- Integration test: create a lane with a real git repo, verify worktree exists, cleanup, verify worktree gone.
- Integration test: orphan reconciliation with pre-created stale worktree directories.
- Integration test: partial provisioning failure (mock git failure), verify no stale state.
- Benchmark: provisioning latency p95 < 5s on a 100 MB repo.
- Benchmark: cleanup latency p95 < 10s.

## Risks & Mitigations

- Risk: git worktree operations are slow on large repos.
- Mitigation: measure and optimize; consider shallow worktrees for large repos.
- Risk: orphaned worktrees accumulate if reconciliation is skipped.
- Mitigation: reconciliation runs unconditionally on startup.

## Review Guidance

- Validate worktree path convention is consistent across provision and cleanup.
- Validate PTY termination ordering: all PTYs stopped before directory removal.
- Confirm orphan reconciliation handles both directions (worktree without record, record without worktree).
- Verify partial failure cleanup at every step of the provisioning sequence.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
