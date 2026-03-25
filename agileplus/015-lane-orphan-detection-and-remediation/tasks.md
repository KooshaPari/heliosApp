# Work Packages: Lane Orphan Detection and Remediation

**Inputs**: Design documents from `/kitty-specs/015-lane-orphan-detection-and-remediation/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 008, 009
**Tests**: Include explicit testing work because the feature spec requires false-positive validation and crash recovery.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/015-lane-orphan-detection-and-remediation/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Watchdog Scheduler and Three Detectors (Priority: P0)

**Phase**: Phase 1 - Detection Foundation
**Goal**: Implement the periodic watchdog scheduler with checkpoint persistence, and the three orphan detectors: worktree, zellij session, and PTY process.
**Independent Test**: Watchdog runs on schedule, detects intentionally orphaned resources with correct classification, produces no false positives on healthy systems, and recovers from checkpoint after crash.
**Prompt**: `/kitty-specs/015-lane-orphan-detection-and-remediation/tasks/WP01-watchdog-scheduler-and-detectors.md`
**Estimated Prompt Size**: ~450 lines

### Included Subtasks
- [ ] T001 Implement watchdog scheduler with configurable interval and checkpoint persistence in `apps/runtime/src/lanes/watchdog/orphan_watchdog.ts` and `apps/runtime/src/lanes/watchdog/checkpoint.ts`
- [ ] T002 Implement orphaned worktree detector in `apps/runtime/src/lanes/watchdog/worktree_detector.ts`
- [ ] T003 Implement stale zellij session detector in `apps/runtime/src/lanes/watchdog/zellij_detector.ts`
- [ ] T004 Implement leaked PTY process detector in `apps/runtime/src/lanes/watchdog/pty_detector.ts`
- [ ] T005 Implement resource classifier (type, age, owning lane, risk level) in `apps/runtime/src/lanes/watchdog/resource_classifier.ts`
- [ ] T006 [P] Add unit tests for all detectors and classifier, including false-positive validation and checkpoint recovery in `apps/runtime/tests/unit/lanes/watchdog/`

### Implementation Notes
- Each detector cross-references filesystem/process state against the active lane and session registries.
- Watchdog checkpoint persists the last completed detection cycle for crash recovery.
- Resource classifier must produce structured reports for the remediation UI.

### Parallel Opportunities
- T006 can proceed after T001-T005 interfaces are stable.

### Dependencies
- Depends on specs 008 (lane lifecycle), 009 (session lifecycle).

### Risks & Mitigations
- Risk: false positives from race conditions between detection and lane creation.
- Mitigation: cross-reference active recovery operations; require resource to be orphaned for two consecutive cycles before reporting.

---

## Work Package WP02: Remediation UI, Recovery Suppression, and Tests (Priority: P1)

**Phase**: Phase 2 - Remediation and Hardening
**Goal**: Implement user-facing remediation suggestions with confirmation gates, recovery-aware suppression, cleanup actions (worktree snapshot, graceful process termination), and comprehensive integration tests.
**Independent Test**: No cleanup executes without user confirmation; cleanup suggestions are suppressed for resources in active recovery; cleanup failures are reported and skipped; false-positive rate is below 1% across 500+ cycles.
**Prompt**: `/kitty-specs/015-lane-orphan-detection-and-remediation/tasks/WP02-remediation-ui-and-recovery-suppression.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T007 Implement remediation suggestion engine with user confirmation gates in `apps/runtime/src/lanes/watchdog/remediation.ts`
- [ ] T008 Implement cleanup actions: worktree metadata snapshot + deletion, graceful PTY termination (SIGTERM/SIGKILL), zellij session kill
- [ ] T009 Implement recovery-aware suppression (suppress suggestions for resources in active recovery) and declined-cleanup cooldown
- [ ] T010 Wire detection and remediation events on the internal bus (FR-015-008)
- [ ] T011 [P] Add integration tests: orphan detection accuracy, no-auto-cleanup enforcement, recovery suppression, cleanup failure handling, false-positive rate validation in `apps/runtime/tests/integration/lanes/watchdog/`

### Implementation Notes
- Remediation suggestions must include resource type, age, estimated owning lane, and risk level.
- Declined cleanup enters configurable cooldown before re-suggesting.
- Cleanup failures must be reported, skipped, and logged without halting remaining actions.

### Parallel Opportunities
- T011 can proceed after T007-T010 interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: cleanup of a resource that is actually recovering from a crash.
- Mitigation: recovery-aware suppression cross-references active recovery operations before suggesting.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 (detection) + WP02 (remediation, tests).

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Watchdog scheduler + checkpoint persistence | WP01 | P0 | No |
| T002 | Orphaned worktree detector | WP01 | P0 | No |
| T003 | Stale zellij session detector | WP01 | P0 | No |
| T004 | Leaked PTY process detector | WP01 | P0 | No |
| T005 | Resource classifier | WP01 | P0 | No |
| T006 | Detector unit tests + false-positive validation | WP01 | P0 | Yes |
| T007 | Remediation suggestion engine | WP02 | P1 | No |
| T008 | Cleanup actions (worktree/PTY/zellij) | WP02 | P1 | No |
| T009 | Recovery-aware suppression + cooldown | WP02 | P1 | No |
| T010 | Detection and remediation bus events | WP02 | P1 | No |
| T011 | Integration tests + false-positive rate validation | WP02 | P1 | Yes |
