# Feature Specification: Lane Orphan Detection and Remediation

**Feature Branch**: `015-lane-orphan-detection-and-remediation`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 008, 009

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect Orphaned Resources Automatically (Priority: P1)

As an operator, I want the system to detect orphaned worktrees, stale zellij sessions, and leaked PTY processes so resource leaks do not accumulate and degrade my system over time.

**Why this priority**: Leaked resources consume memory and disk, cause confusion when stale sessions appear in listings, and can interfere with new lane creation.

**Independent Test**: Can be tested by creating lanes, force-killing their parent processes to simulate crashes, running the watchdog, and verifying all orphaned resources are identified with correct classification.

**Acceptance Scenarios**:

1. **Given** a lane whose parent process has been force-killed, **When** the watchdog runs its detection cycle, **Then** the orphaned worktree, stale zellij session, and any leaked PTY processes are identified and reported.
2. **Given** a healthy system with no orphans, **When** the watchdog runs, **Then** no false positives are reported.
3. **Given** multiple orphaned resources of different types, **When** the watchdog reports, **Then** each resource is classified by type (worktree, zellij session, PTY process) with its age and owning lane if determinable.

---

### User Story 2 - Review and Confirm Cleanup Actions (Priority: P1)

As an operator, I want to review remediation suggestions before any cleanup occurs so I never lose work that might still be recoverable.

**Why this priority**: Automatic cleanup of resources the user considers valuable would cause data loss and erode trust.

**Independent Test**: Can be tested by triggering remediation suggestions, verifying no cleanup occurs without confirmation, and then confirming cleanup and verifying the resources are removed.

**Acceptance Scenarios**:

1. **Given** detected orphaned resources, **When** the system presents remediation suggestions, **Then** no resources are cleaned up until the user explicitly confirms.
2. **Given** a remediation suggestion for a stale zellij session, **When** the user confirms cleanup, **Then** the session is terminated and its resources are released.
3. **Given** a remediation suggestion, **When** the user declines cleanup, **Then** the resource is marked as reviewed and excluded from the next detection cycle (until a configurable cooldown expires).

---

### User Story 3 - Safe Cleanup Actions (Priority: P2)

As an operator, cleanup actions should be safe and reversible where possible so I can recover if a cleanup was mistaken.

**Why this priority**: Even confirmed cleanups can be wrong; safety nets reduce the blast radius of mistakes.

**Independent Test**: Can be tested by confirming cleanup of a worktree, verifying a snapshot/backup was taken before deletion, and confirming the backup can be used to restore.

**Acceptance Scenarios**:

1. **Given** a confirmed worktree cleanup, **When** cleanup executes, **Then** a lightweight snapshot of the worktree metadata is preserved for a configurable retention period before final deletion.
2. **Given** a confirmed PTY process cleanup, **When** cleanup executes, **Then** the process is terminated gracefully (SIGTERM then SIGKILL after timeout).

---

### Edge Cases

- What happens when an orphan is detected but its owning lane is actually recovering? The system MUST cross-reference active recovery operations and suppress cleanup suggestions for resources involved in active recovery.
- What happens when the watchdog itself crashes? The system MUST recover watchdog state on next startup and resume detection from the last known checkpoint.
- What happens when cleanup of one resource fails? The system MUST report the failure, skip the resource, and continue with remaining cleanup actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-015-001**: The system MUST run a periodic watchdog that detects orphaned worktrees not associated with any active lane.
- **FR-015-002**: The system MUST detect stale zellij sessions that have no corresponding active lane or session binding.
- **FR-015-003**: The system MUST detect leaked PTY processes that have no parent lane or session.
- **FR-015-004**: The system MUST present remediation suggestions to the user without performing automatic cleanup.
- **FR-015-005**: The system MUST require explicit user confirmation before executing any cleanup action.
- **FR-015-006**: The system MUST classify each orphaned resource by type, age, estimated owning lane, and risk level.
- **FR-015-007**: The system MUST suppress cleanup suggestions for resources involved in active recovery operations.
- **FR-015-008**: The system MUST emit detection and remediation events on the internal bus.
- **FR-015-009**: The system MUST support a configurable detection interval and cooldown for declined cleanup suggestions.

### Non-Functional Requirements

- **NFR-015-001**: Watchdog detection cycles MUST complete in under 2 seconds for systems with up to 100 lanes.
- **NFR-015-002**: Watchdog MUST NOT consume more than 1% CPU on average during idle periods.
- **NFR-015-003**: False positive rate for orphan detection MUST be below 1% across the test matrix.

### Key Entities

- **Orphaned Worktree**: A git worktree on disk with no corresponding active lane in the registry.
- **Stale Zellij Session**: A zellij session with no active lane or session binding in the terminal registry.
- **Leaked PTY Process**: A PTY-attached process with no parent lane or session ownership.
- **Remediation Suggestion**: A proposed cleanup action with resource details, risk classification, and confirmation requirement.
- **Watchdog Checkpoint**: Persisted state of the last completed detection cycle for crash recovery.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-015-001**: 100% of intentionally orphaned resources in test scenarios are detected within two watchdog cycles.
- **SC-015-002**: Zero resources are cleaned up without explicit user confirmation.
- **SC-015-003**: False positive rate is below 1% across 500+ detection cycles in the test harness.
- **SC-015-004**: Watchdog detection cycle time stays under 2 seconds with 50 active lanes and 20 orphaned resources.

## Assumptions

- Lane lifecycle management (spec 008) and session lifecycle management (spec 009) emit events that the watchdog can consume to build its active-resource index.
- The system has filesystem access to enumerate worktrees and process-table access to enumerate PTY processes.
- zellij provides a queryable API or CLI for listing active sessions.
- Cleanup actions for worktrees and processes use standard OS-level operations.
