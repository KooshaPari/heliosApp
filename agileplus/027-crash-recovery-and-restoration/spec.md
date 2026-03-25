# Feature Specification: Crash Recovery and Session Restoration

**Feature Branch**: `027-crash-recovery-and-restoration`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Crash recovery and session restoration pipeline for heliosApp. When any critical process (ElectroBun host, runtime daemon, renderer worker) terminates abnormally, the system detects the failure, inventories recoverable state from zmx checkpoints and zellij sessions, restores what it can, and clearly reports what could not be recovered. The goal is maximum automatic recovery with honest reporting of losses.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automatic Recovery After Crash (Priority: P0)

As an operator, I expect heliosApp to restore my terminal sessions and workspace state automatically after a crash so that I lose minimal work.

**Why this priority**: Crash recovery is the difference between a trusted tool and a liability.

**Independent Test**: Kill the runtime daemon process, relaunch heliosApp, verify that terminal sessions are restored from zmx checkpoints.

**Acceptance Scenarios**:

1. **Given** an active workspace with 5 terminal sessions, **When** the runtime daemon crashes and the app relaunches, **Then** the recovery pipeline restores all 5 sessions from zmx checkpoints and the operator sees a recovery summary.
2. **Given** a crash during boot, **When** the system detects a previous incomplete recovery, **Then** it resumes recovery from the last successful stage rather than restarting from scratch.
3. **Given** a crash, **When** 2 of 5 sessions have corrupted checkpoints, **Then** the 3 recoverable sessions are restored and the 2 unrecoverable sessions are reported with manual intervention prompts.

---

### User Story 2 — Recovery Progress Visibility (Priority: P0)

As an operator, I can see what the recovery pipeline is doing so that I know whether to wait or intervene.

**Why this priority**: Silent recovery erodes trust; visible progress builds confidence.

**Acceptance Scenarios**:

1. **Given** a recovery in progress, **When** the app window appears, **Then** a recovery banner shows the current stage (detecting, inventorying, restoring, reconciling) and a progress indicator.
2. **Given** recovery completes, **When** all stages succeed, **Then** the banner transitions to a dismissible "recovery complete" summary listing restored items.
3. **Given** recovery completes with partial failures, **When** unrecoverable items exist, **Then** the summary clearly lists what was lost and offers manual intervention options.

---

### User Story 3 — Orphan Reconciliation Post-Recovery (Priority: P1)

As an operator, I expect the system to clean up orphaned processes and artifacts left by the crash so that resource leaks do not accumulate.

**Why this priority**: Post-crash orphans degrade system performance over time.

**Acceptance Scenarios**:

1. **Given** a completed recovery, **When** orphan reconciliation runs, **Then** orphaned PTY processes, stale zellij sessions, and abandoned par lanes are detected and flagged.
2. **Given** orphaned artifacts are found, **When** they can be safely terminated, **Then** they are cleaned up automatically with an audit log entry.
3. **Given** an orphan that cannot be safely classified, **When** reconciliation encounters it, **Then** it is flagged for user review rather than terminated.

---

### Edge Cases

- Crash during an active zmx checkpoint operation must not corrupt the checkpoint file; write-ahead or atomic-rename strategies are expected.
- Rapid successive crashes (crash loop) must be detected; after 3 crashes within 60 seconds, the system enters safe mode with minimal subsystems.
- Recovery must handle clock skew gracefully (checkpoint timestamps compared with tolerance).
- Recovery of a terminal whose underlying shell process no longer exists must spawn a fresh shell in the same working directory.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-027-001**: The system MUST detect abnormal termination of ElectroBun host, runtime daemon, and renderer worker processes via exit code monitoring and watchdog heartbeat timeouts.
- **FR-027-002**: The system MUST implement a recovery state machine with states: crashed, detecting, inventorying, restoring, reconciling, live, and explicit failure states.
- **FR-027-003**: The system MUST use zmx checkpoints for terminal session restoration, with checkpoint intervals driven by time-based and activity-based heuristics.
- **FR-027-004**: The system MUST validate zmx checkpoint integrity before attempting restore.
- **FR-027-005**: The system MUST reattach zellij sessions, re-inventory par lanes, re-spawn terminal PTYs from zmx checkpoints, and restart renderers during restoration.
- **FR-027-006**: The system MUST run an orphan reconciliation scan after recovery, integrating with spec 015 orphan detection.
- **FR-027-007**: The system MUST display a recovery banner/modal with stage indicators and progress during restoration.
- **FR-027-008**: The system MUST present a "what was recovered" summary upon completion, with clear reporting of unrecoverable items and manual intervention prompts.
- **FR-027-009**: The system MUST detect crash loops (3+ crashes in 60 seconds) and enter safe mode.
- **FR-027-010**: The system MUST support partial recovery, restoring everything possible and reporting losses.

### Non-Functional Requirements

- **NFR-027-001**: Recovery from crash to live state MUST complete within 10 seconds (p95) for a typical workload (25 terminals).
- **NFR-027-002**: zmx checkpoint write MUST be atomic; a crash during checkpoint MUST NOT corrupt the checkpoint file.
- **NFR-027-003**: Checkpoint storage overhead MUST NOT exceed 50 MB for a typical workload (25 terminals).
- **NFR-027-004**: Orphan reconciliation MUST complete within 5 seconds (p95) post-recovery.

### Dependencies

- **Spec 007** (PTY Management): Terminal PTY re-spawn during restoration.
- **Spec 008** (Par Lanes): Lane re-inventory and state reconciliation.
- **Spec 009** (Zellij Sessions): Session reattach and mux state recovery.
- **Spec 015** (Orphan Detection): Post-recovery orphan scan integration.

## Key Entities

- **Recovery State Machine**: Ordered state progression governing the crash-to-live recovery lifecycle.
- **zmx Checkpoint**: A serialized snapshot of terminal session state (PTY state, scrollback, environment) used for restoration.
- **Recovery Banner**: A UI overlay showing recovery stage, progress, and completion summary.
- **Orphan Artifact**: A process or resource left behind by a crash that is no longer associated with an active session.
- **Safe Mode**: A minimal-subsystem operating mode entered after crash loop detection.

## Success Criteria *(mandatory)*

- **SC-027-001**: Recovery restores 100% of sessions with valid zmx checkpoints in automated crash-recovery tests.
- **SC-027-002**: Recovery completes in < 10s for 25 terminals in 95% of test runs.
- **SC-027-003**: Partial recovery correctly identifies and reports unrecoverable items in 100% of corrupted-checkpoint tests.
- **SC-027-004**: Crash loop detection triggers safe mode within 5 seconds of the third crash in 100% of crash-loop tests.
- **SC-027-005**: Zero orphan processes remain 30 seconds post-recovery in 100% of chaos test runs.

## Assumptions

- zmx is the checkpoint/restore mechanism; alternative snapshot tools are out of scope.
- Checkpoint storage uses local filesystem; remote checkpoint sync is deferred.
- Reference hardware: 8 GB RAM, 4-core CPU. Recovery SLOs are baselined against this.
- Orphan detection (spec 015) provides the scanning primitives; this spec orchestrates their use post-crash.
