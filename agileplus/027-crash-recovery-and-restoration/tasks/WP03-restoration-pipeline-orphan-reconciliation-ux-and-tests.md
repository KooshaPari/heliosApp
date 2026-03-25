---
work_package_id: WP03
title: Restoration Pipeline, Orphan Reconciliation, UX, and Tests
lane: "planned"
dependencies:
- WP01
- WP02
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T010
- T011
- T012
- T013
- T014
phase: Phase 2 - Restoration and Hardening
assignee: ''
agent: ''
shell_pid: ''
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 - Restoration Pipeline, Orphan Reconciliation, UX, and Tests

## Objectives & Success Criteria

- Implement the restoration pipeline that reattaches zellij sessions, re-inventories par lanes, and re-spawns PTYs from zmx checkpoints.
- Implement orphan reconciliation that scans for and cleans up orphaned processes and artifacts post-recovery.
- Deliver a recovery banner UI showing recovery stage progress and completion summary.
- Deliver comprehensive integration and chaos tests for the complete crash-to-live recovery cycle.

Success criteria:
- Recovery restores 100% of sessions with valid checkpoints (SC-027-001).
- Recovery completes in < 10s for 25 terminals (SC-027-002).
- Partial recovery correctly reports unrecoverable items (SC-027-003).
- Zero orphan processes remain 30s post-recovery (SC-027-005).
- Recovery banner shows progress and honest loss reporting.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/027-crash-recovery-and-restoration/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/027-crash-recovery-and-restoration/spec.md`
- WP01-WP02 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/watchdog.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/safe-mode.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/state-machine.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/checkpoint.ts`
- Orphan detection (spec 015):
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/` (orphan scanning primitives)

Constraints:
- Crash-to-live < 10s for 25 terminals (NFR-027-001).
- Orphan reconciliation < 5s (NFR-027-004).
- Restoration order: zellij reattach first, then lane re-inventory, then PTY re-spawn.
- Unclassifiable orphans flagged for user review, not auto-terminated.
- Coverage >=85% with FR-027-005 through FR-027-010 traceability.

Implementation command:
- `spec-kitty implement WP03`

## Subtasks & Detailed Guidance

### Subtask T010 - Implement restoration pipeline

- Purpose: Restore terminal sessions and workspace state from checkpoints and live zellij sessions.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/restoration.ts`.
  2. Implement `RestorationPipeline` class:
     - `restore(checkpoint: Checkpoint): Promise<RestorationResult>`.
     - `RestorationResult`: `{ restored: RestoredSession[], failed: FailedSession[], duration: number }`.
  3. Implement restoration stages in order:
     a. **Zellij session reattach** (INVENTORYING -> RESTORING transition):
        - List surviving zellij sessions via `zellij list-sessions`.
        - Match surviving sessions to checkpoint sessions by session name.
        - Reattach matched sessions (they survived the crash).
        - Mark matched sessions as restored.
     b. **Par lane re-inventory**:
        - List existing par lanes via spec 008 primitives.
        - Match lanes to checkpoint lane IDs.
        - Restore lane metadata and state.
     c. **PTY re-spawn for unmatched sessions**:
        - For checkpoint sessions without surviving zellij sessions:
          - Spawn new shell in the checkpoint's working directory.
          - Set environment variables from checkpoint.
          - Create new zellij session with the spawned shell.
          - Restore scrollback if available (best-effort).
        - Mark as restored or failed depending on outcome.
  4. Handle restoration failures per session:
     - If zellij reattach fails: attempt PTY re-spawn.
     - If PTY re-spawn fails (e.g., working directory no longer exists): mark as failed with reason.
     - Failed sessions are reported, not retried (operator decides).
  5. Measure and report restoration duration.
  6. Publish bus events: `recovery.session.restored`, `recovery.session.failed` for each session.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/restoration.ts`
- Validation:
  - All sessions with surviving zellij are reattached.
  - Sessions without zellij are re-spawned from checkpoint.
  - Failed sessions are reported with clear reasons.
  - Duration is < 10s for 25 sessions.
  - Bus events emitted per session.
- Parallel: No.

### Subtask T011 - Implement orphan reconciliation scan

- Purpose: Clean up orphaned processes and artifacts left by the crash.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/orphan-reconciler.ts`.
  2. Implement `OrphanReconciler` class:
     - `scan(): Promise<OrphanReport>` -- detect orphaned resources.
     - `cleanup(report: OrphanReport): Promise<CleanupResult>` -- clean up safely classifiable orphans.
  3. Implement orphan detection by integrating spec 015 primitives:
     a. **Orphan PTY processes**: list PTY processes owned by heliosApp but not associated with any restored session.
     b. **Stale zellij sessions**: list zellij sessions not matched to any restored session.
     c. **Abandoned par lanes**: list par worktree-backed lanes not matched to restored lanes.
     d. **Orphan share workers**: list share worker processes with no active share session.
     e. **Stale temp files**: list checkpoint temp files and other recovery artifacts.
  4. Implement safe classification:
     - `SafeToTerminate`: process/resource clearly orphaned, safe to kill.
     - `NeedsReview`: process/resource cannot be safely classified (flag for user).
  5. Implement cleanup:
     - Terminate `SafeToTerminate` resources (SIGTERM, wait 3s, SIGKILL).
     - Remove stale temp files.
     - Log cleanup actions as audit events.
     - Leave `NeedsReview` items for user action.
  6. `OrphanReport` type: `{ safeToTerminate: OrphanItem[], needsReview: OrphanItem[], totalFound: number }`.
  7. `CleanupResult` type: `{ terminated: number, removed: number, reviewPending: number }`.
  8. Publish `recovery.orphans.cleaned` bus event with cleanup result.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/orphan-reconciler.ts`
- Validation:
  - Orphan PTYs, zellij sessions, and par lanes are detected.
  - Safe-to-terminate orphans are cleaned up.
  - Needs-review orphans are flagged, not terminated.
  - Cleanup completes within 5s (NFR-027-004).
  - Audit events recorded for all cleanup actions.
- Parallel: No.

### Subtask T012 - Implement recovery banner UI

- Purpose: Provide visible recovery progress to build operator trust.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/banner.ts`.
  2. Implement `RecoveryBanner` class managing banner state:
     - `show(stage: RecoveryStage): void` -- display banner with current stage.
     - `updateProgress(stage: RecoveryStage, detail: string): void` -- update progress within stage.
     - `showSummary(result: RestorationResult, orphanResult: CleanupResult): void` -- show completion summary.
     - `dismiss(): void` -- operator dismisses banner.
  3. Banner content per stage:
     - DETECTING: "Detecting crash... checking processes."
     - INVENTORYING: "Inventorying recoverable state... found N checkpoints."
     - RESTORING: "Restoring sessions... M of N complete."
     - RECONCILING: "Cleaning up orphaned processes..."
     - LIVE: summary with restored count, failed count, orphans cleaned.
  4. Summary content:
     - Restored: list of restored session names.
     - Failed: list of failed sessions with reasons and manual intervention suggestions.
     - Orphans: count cleaned, count needing review.
     - "Recovery complete" or "Recovery complete with issues" header.
  5. Subscribe to bus events for stage transitions and update banner reactively.
  6. Banner must be visible immediately on app launch after crash (before other UI loads).
  7. Implement banner as lightweight overlay that does not depend on full UI framework loading.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/banner.ts`
- Validation:
  - Banner shows correct stage during recovery.
  - Progress updates within stages.
  - Summary lists restored and failed items.
  - Banner is dismissible after completion.
  - Banner appears before full UI loads.
- Parallel: No.

### Subtask T013 - Add integration tests for full recovery pipeline

- Purpose: Verify end-to-end crash-to-live recovery with valid and corrupted checkpoints.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/integration.test.ts`.
  2. **Full recovery test** (SC-027-001):
     - Set up 5 mock sessions with valid checkpoints.
     - Simulate crash (write crash record).
     - Run recovery pipeline.
     - Verify all 5 sessions restored.
     - Verify state machine progressed through all stages to LIVE.
     - Verify duration < 10s.
  3. **Partial recovery test** (SC-027-003):
     - Set up 5 sessions, corrupt 2 checkpoints.
     - Run recovery pipeline.
     - Verify 3 sessions restored, 2 reported as failed.
     - Verify recovery summary lists failures with reasons.
  4. **Crash during recovery test**:
     - Set up sessions, simulate crash during RESTORING stage (persist stage to disk).
     - Re-run recovery.
     - Verify resume from RESTORING (not from DETECTING).
     - Verify previously restored sessions are not re-restored.
  5. **Zellij reattach test**:
     - Set up sessions with some having surviving zellij sessions.
     - Verify surviving sessions are reattached (not re-spawned).
     - Verify non-surviving sessions are re-spawned from checkpoint.
  6. **Missing working directory test**:
     - Checkpoint references working directory that no longer exists.
     - Verify session is marked as failed with clear reason.
  7. Map tests to SC-027-001, SC-027-002, SC-027-003.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/integration.test.ts`
- Validation:
  - All test scenarios pass.
  - Each SC-027-001/002/003 has at least one mapped test.
  - Coverage across restoration.ts >=85%.
- Parallel: Yes (after T010-T012 are stable).

### Subtask T014 - Add chaos tests and orphan reconciliation verification

- Purpose: Prove crash recovery works under realistic failure conditions.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/chaos.test.ts`.
  2. **SIGKILL crash test**:
     - Start mock runtime with active sessions.
     - Send SIGKILL to runtime process.
     - Relaunch and run recovery.
     - Verify all sessions with valid checkpoints are restored.
  3. **Crash during checkpoint write test**:
     - Simulate crash during checkpoint write (leave temp file, no rename).
     - Verify previous checkpoint is used for recovery.
     - Verify temp file is cleaned up.
  4. **Crash loop test** (SC-027-004):
     - Trigger 3 rapid crashes within 60s.
     - Verify safe mode entry within 5s.
     - Verify safe mode disables non-essential subsystems.
  5. **Orphan reconciliation test** (SC-027-005):
     - After recovery, create orphan PTY processes and stale zellij sessions.
     - Run orphan reconciliation.
     - Verify safe-to-terminate orphans are cleaned.
     - Verify needs-review orphans are flagged.
     - Verify zero orphan processes 30s post-recovery.
  6. **Concurrent recovery and activity test**:
     - Start recovery while new terminal operations are requested.
     - Verify recovery completes without interference.
     - Verify new operations are queued until recovery reaches LIVE state.
  7. Run each chaos scenario 5+ times for reliability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/chaos.test.ts`
- Validation:
  - All chaos scenarios pass across multiple runs.
  - SC-027-004 and SC-027-005 fully covered.
  - Zero orphan processes in all post-recovery checks.
- Parallel: Yes (after T010-T012 are stable).

## Test Strategy

- Integration tests use mock sessions, checkpoints, and zellij commands.
- Chaos tests use real process spawning with SIGKILL injection.
- Orphan tests create real orphan processes and verify cleanup.
- All tests use temporary filesystem directories.
- Banner tests verify state transitions via bus event injection.

## Risks & Mitigations

- Risk: Zellij session list command is slow or unreliable.
- Mitigation: Add timeout to zellij list call; treat timeout as "no surviving sessions" and fall back to checkpoint re-spawn.
- Risk: Orphan detection false positives cause cleanup of wanted processes.
- Mitigation: NeedsReview classification for anything not clearly orphaned; safe-to-terminate only for heliosApp-owned processes.

## Review Guidance

- Confirm restoration order: zellij reattach -> lane re-inventory -> PTY re-spawn.
- Confirm partial recovery reports losses honestly.
- Confirm orphan reconciliation does not auto-terminate unclassifiable resources.
- Confirm recovery banner appears before full UI loads.
- Confirm chaos tests achieve 100% recovery across multiple runs.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
