# Work Packages: Crash Recovery and Restoration

**Inputs**: Design documents from `/kitty-specs/027-crash-recovery-and-restoration/`
**Prerequisites**: plan.md (required), spec.md (user stories), related specs (007, 008, 009, 015)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/027-crash-recovery-and-restoration/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Crash Detection and Watchdog (Priority: P0 -- prerequisite to all other WPs)

**Phase**: Phase 0 - Detection
**Goal**: Implement crash detection via watchdog heartbeat timeouts and exit code monitoring for runtime daemon, ElectroBun host, and renderer workers. Detect crash loops and trigger safe mode.
**Independent Test**: Kill runtime daemon, verify watchdog detects crash within 2s. Trigger 3 rapid crashes, verify safe mode entry within 5s.
**Prompt**: `/kitty-specs/027-crash-recovery-and-restoration/tasks/WP01-crash-detection-and-watchdog.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T001 Implement watchdog heartbeat monitor for runtime daemon, ElectroBun host, and renderer workers in `apps/runtime/src/recovery/watchdog.ts`
- [ ] T002 Implement exit code monitoring and abnormal termination detection
- [ ] T003 Implement crash loop detection (3 crashes in 60s) and safe mode entry in `apps/runtime/src/recovery/safe-mode.ts`
- [ ] T004 [P] Add unit tests for watchdog heartbeat, exit code monitoring, crash loop detection, and safe mode entry

### Implementation Notes
- Heartbeat interval should be configurable (default 2s).
- Watchdog must itself be resilient; it is the first process to detect failures.
- Safe mode runs minimal subsystems only (no providers, no sharing, no background tasks).

### Parallel Opportunities
- T004 can proceed after T001-T003 are stable.

### Dependencies
- None (foundation WP).

### Risks & Mitigations
- Risk: Watchdog itself crashes, leaving system unmonitored.
- Mitigation: Watchdog is intentionally minimal; on watchdog crash, next app launch detects stale PID file.

---

## Work Package WP02: Recovery State Machine and zmx Checkpoint Strategy (Priority: P0)

**Goal**: Implement the recovery state machine (crashed -> detecting -> inventorying -> restoring -> reconciling -> live) with resumable stages and zmx checkpoint read/write with atomic operations.
**Independent Test**: State machine progresses through all stages on valid checkpoints; crash-during-recovery resumes from last successful stage; corrupted checkpoint is detected and skipped.
**Prompt**: `/kitty-specs/027-crash-recovery-and-restoration/tasks/WP02-recovery-state-machine-and-zmx-checkpoint-strategy.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T005 Implement recovery state machine with ordered stages, failure states, and stage persistence in `apps/runtime/src/recovery/state-machine.ts`
- [ ] T006 Implement zmx checkpoint read/write with atomic operations (write-ahead or atomic-rename) in `apps/runtime/src/recovery/checkpoint.ts`
- [ ] T007 Implement checkpoint integrity validation and corruption detection
- [ ] T008 Implement time-based and activity-based checkpoint interval heuristics
- [ ] T009 [P] Add unit tests for state machine transitions, checkpoint atomicity, integrity validation, and interval heuristics

### Implementation Notes
- State machine must persist current stage to disk so crash-during-recovery can resume.
- Atomic writes use rename strategy: write to temp file, fsync, rename to final path.
- Checkpoint validation uses checksum (CRC32 or SHA256) stored in checkpoint header.

### Parallel Opportunities
- T009 can proceed after T005-T008 are stable.

### Dependencies
- Depends on WP01 (crash detection triggers recovery).

### Risks & Mitigations
- Risk: Checkpoint write during high I/O causes latency spike.
- Mitigation: Activity-based heuristic defers checkpoint during burst activity; time-based ensures eventual checkpoint.

---

## Work Package WP03: Restoration Pipeline, Orphan Reconciliation, UX, and Tests (Priority: P1)

**Goal**: Implement the restoration pipeline (zellij reattach, par lane re-inventory, PTY re-spawn), orphan reconciliation integrating spec 015, recovery banner UI, and comprehensive tests including chaos injection.
**Independent Test**: Kill runtime, relaunch, verify all sessions restored from checkpoints; orphan processes cleaned up; recovery banner shows progress and summary; crash with corrupted checkpoints reports losses.
**Prompt**: `/kitty-specs/027-crash-recovery-and-restoration/tasks/WP03-restoration-pipeline-orphan-reconciliation-ux-and-tests.md`
**Estimated Prompt Size**: ~450 lines

### Included Subtasks
- [ ] T010 Implement restoration pipeline: zellij session reattach, par lane re-inventory, PTY re-spawn from checkpoints in `apps/runtime/src/recovery/restoration.ts`
- [ ] T011 Implement orphan reconciliation scan integrating spec 015 primitives in `apps/runtime/src/recovery/orphan-reconciler.ts`
- [ ] T012 Implement recovery banner UI with stage indicators, progress, and completion summary in `apps/runtime/src/recovery/banner.ts`
- [ ] T013 [P] Add integration tests for full recovery pipeline (crash -> detect -> restore -> live) with valid and corrupted checkpoints
- [ ] T014 [P] Add chaos tests (SIGKILL injection, crash-during-recovery, crash loops) and orphan reconciliation verification

### Implementation Notes
- Restoration order matters: reattach zellij sessions first (they may still be alive), then re-inventory lanes, then re-spawn PTYs for sessions without live zellij.
- Orphan reconciliation must flag unclassifiable resources for user review, not auto-terminate.
- Recovery banner must be visible immediately on app launch after crash.

### Parallel Opportunities
- T013 and T014 can proceed after T010-T012 implementations are stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: Zellij sessions terminated by OS before reattach attempt.
- Mitigation: Check zellij session existence before reattach; fall back to PTY re-spawn from checkpoint.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 (detection) + WP02 (state machine + checkpoints) + WP03 (restoration + UX) form a complete crash recovery pipeline.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Watchdog heartbeat monitor | WP01 | P0 | No |
| T002 | Exit code monitoring | WP01 | P0 | No |
| T003 | Crash loop detection and safe mode | WP01 | P0 | No |
| T004 | Watchdog and safe mode unit tests | WP01 | P0 | Yes |
| T005 | Recovery state machine | WP02 | P0 | No |
| T006 | zmx checkpoint atomic read/write | WP02 | P0 | No |
| T007 | Checkpoint integrity validation | WP02 | P0 | No |
| T008 | Checkpoint interval heuristics | WP02 | P0 | No |
| T009 | State machine and checkpoint unit tests | WP02 | P0 | Yes |
| T010 | Restoration pipeline | WP03 | P1 | No |
| T011 | Orphan reconciliation scan | WP03 | P1 | No |
| T012 | Recovery banner UI | WP03 | P1 | No |
| T013 | Recovery pipeline integration tests | WP03 | P1 | Yes |
| T014 | Chaos tests and orphan verification | WP03 | P1 | Yes |
