# Feature Specification: Transactional Renderer Switching

**Feature Branch**: `013-renderer-switch-transaction`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 010, 011, 012

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hot-Swap Renderer Without Losing Work (Priority: P1)

As an operator with active terminal sessions, I can switch from ghostty to rio (or vice versa) without losing PTY streams or session context so I can evaluate renderer quality without workflow interruption.

**Why this priority**: Renderer switching that drops active work is a deal-breaker for adoption of dual-renderer support.

**Independent Test**: Can be tested by running an active long-running command in a terminal, triggering a hot-swap, and verifying the command output stream is continuous and the session context is intact after the swap completes.

**Acceptance Scenarios**:

1. **Given** both renderers support hot-swap for the current terminal configuration, **When** the user triggers a renderer switch, **Then** the switch completes in under 3 seconds with no dropped PTY bytes.
2. **Given** an active terminal session with scrollback history, **When** a hot-swap completes, **Then** scrollback content and cursor position are preserved.
3. **Given** multiple terminals across lanes, **When** a renderer switch is triggered, **Then** all terminals transition atomically or none do.

---

### User Story 2 - Restart-With-Restore Fallback (Priority: P1)

As an operator switching to a renderer that does not support hot-swap, I can trigger the switch and have the system restart the renderer with full session restore so I do not need to manually reconstruct my work.

**Why this priority**: Not all renderer transitions can be hot-swapped; the fallback path must be equally reliable.

**Independent Test**: Can be tested by disabling hot-swap capability via feature flag, triggering a switch, and verifying session restore completes within SLO with full state recovery.

**Acceptance Scenarios**:

1. **Given** hot-swap is unavailable for the target renderer, **When** the user triggers a switch, **Then** the system performs restart-with-restore and completes within 8 seconds.
2. **Given** a restart-with-restore in progress, **When** the restore completes, **Then** all PTY streams are reconnected and session metadata matches pre-switch state.

---

### User Story 3 - Automatic Rollback on Failure (Priority: P1)

As an operator, if a renderer switch fails mid-transaction, I expect the system to automatically roll back to the previous renderer so I am never left in a broken state.

**Why this priority**: A failed switch that leaves terminals unusable is worse than no switch at all.

**Independent Test**: Can be tested by injecting a failure during renderer initialization, and verifying the original renderer is restored with all sessions intact.

**Acceptance Scenarios**:

1. **Given** a renderer switch transaction in progress, **When** the target renderer fails to initialize, **Then** the system rolls back to the previous renderer within 5 seconds.
2. **Given** a rollback has occurred, **When** the user inspects terminal state, **Then** all sessions, PTY streams, and scrollback are identical to pre-switch state.
3. **Given** a rollback, **When** the rollback completes, **Then** the user receives a clear notification of the failure reason and rollback outcome.

---

### Edge Cases

- What happens when rollback itself fails? The system MUST enter a degraded-but-safe mode where PTY streams are preserved headlessly and the user is prompted to restart.
- What happens during a switch when a new terminal is created? The system MUST queue terminal creation until the transaction completes or rolls back.
- What happens if the user triggers a second switch during an active transaction? The system MUST reject the request and surface the in-progress transaction status.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-013-001**: The system MUST execute renderer switches as atomic transactions with commit/rollback semantics.
- **FR-013-002**: The system MUST attempt hot-swap when both source and target renderers support it for the current terminal configuration.
- **FR-013-003**: The system MUST fall back to restart-with-restore when hot-swap is unavailable, using zmx checkpoint data for session recovery.
- **FR-013-004**: The system MUST automatically roll back to the previous renderer on any failure during the switch transaction.
- **FR-013-005**: The system MUST preserve all active PTY streams during the switch; no bytes may be dropped.
- **FR-013-006**: The system MUST preserve session context (scrollback, cursor position, environment, working directory) across the switch.
- **FR-013-007**: The system MUST reject concurrent switch requests while a transaction is in progress.
- **FR-013-008**: The system MUST emit lifecycle events on the internal bus for switch-started, switch-committed, switch-rolled-back, and switch-failed.

### Non-Functional Requirements

- **NFR-013-001**: Hot-swap renderer transitions MUST complete in under 3 seconds at p95.
- **NFR-013-002**: Restart-with-restore transitions MUST complete in under 8 seconds at p95.
- **NFR-013-003**: Rollback from a failed switch MUST complete in under 5 seconds at p95.
- **NFR-013-004**: During the switch transaction window, terminal input latency MUST NOT exceed 200ms p95.

### Key Entities

- **Switch Transaction**: A bounded operation with states: pending, hot-swapping, restarting, committing, rolling-back, committed, rolled-back, failed.
- **Renderer Capability Matrix**: Declared capabilities of each renderer (hot-swap support, feature flags, version constraints).
- **PTY Stream Proxy**: Intermediary that buffers PTY I/O during switch to prevent byte loss.
- **Switch Checkpoint**: zmx snapshot taken before the switch begins, used for rollback or restart-restore.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-013-001**: 100% of hot-swap transitions complete without dropped PTY bytes in test harness runs.
- **SC-013-002**: At least 98% of restart-with-restore transitions recover all sessions within the 8-second SLO.
- **SC-013-003**: 100% of injected switch failures result in successful automatic rollback with no user-visible state loss.
- **SC-013-004**: Zero occurrences of terminals left in an unusable state after any switch attempt across the full test matrix.

## Assumptions

- Renderer capability declarations (hot-swap support) are provided by specs 010, 011, and 012.
- zmx checkpoint/restore (spec 012) is functional and can snapshot/restore terminal session state within the timing budget.
- The internal event bus is operational for lifecycle event emission.
- PTY stream proxy buffering can sustain typical terminal throughput for the duration of the switch window without overflow.
