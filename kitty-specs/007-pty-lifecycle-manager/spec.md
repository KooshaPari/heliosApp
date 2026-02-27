# Feature Specification: PTY Lifecycle Manager

**Feature Branch**: `007-pty-lifecycle-manager`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 001 (Control Plane), 002 (Local Bus)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spawn and Interact with Terminal Processes (Priority: P1)

As an operator, I can spawn terminal processes that bind to lanes and sessions so that each terminal maps to a known execution context with predictable lifecycle behavior.

**Why this priority**: PTY spawn/attach is the foundational primitive for every terminal interaction in the system.

**Independent Test**: Spawn a PTY, send input, observe output, resize the terminal, and verify the PTY adapts. Terminate the PTY and confirm cleanup completes.

**Acceptance Scenarios**:

1. **Given** a lane with an active session, **When** a terminal spawn is requested, **Then** a PTY process is created, registered, and transitions to `active` state within 500ms.
2. **Given** an active PTY, **When** input bytes are written, **Then** they are delivered to the child process without reordering or loss.
3. **Given** an active PTY, **When** a resize event is issued, **Then** the PTY dimensions update and the child process receives SIGWINCH.
4. **Given** an active PTY, **When** terminate is requested, **Then** the process receives SIGTERM, escalates to SIGKILL after a configurable grace period, and transitions to `stopped`.

---

### User Story 2 - PTY Failure Isolation (Priority: P1)

As an operator running multiple lanes, I expect a single PTY failure to remain isolated so that other terminals and the global runtime continue unaffected.

**Why this priority**: Failure isolation is a constitutional requirement -- external failures must isolate to lane-level.

**Independent Test**: Force-crash a PTY child process and verify sibling PTYs remain in `active` state and the runtime stays responsive.

**Acceptance Scenarios**:

1. **Given** multiple active PTYs, **When** one child process exits unexpectedly, **Then** only that PTY transitions to `errored`; all others remain `active`.
2. **Given** a PTY in `errored` state, **When** the system publishes the error event on the bus, **Then** the event includes PTY ID, lane ID, exit code, and signal information.

---

### Edge Cases

- What happens when PTY spawn fails due to resource exhaustion? The system must transition the PTY to `errored`, publish a diagnostic event, and leave the lane available for retry.
- How does the system handle a PTY that stops producing output but has not exited? The system must support a configurable idle timeout that transitions the PTY to `throttled` and alerts the operator.
- What happens when a signal cannot be delivered to a zombie process? The system must detect the zombie state, force cleanup of the PTY record, and release associated resources.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-007-001**: The system MUST manage PTY processes through a state machine with states: `idle`, `spawning`, `active`, `throttled`, `errored`, `stopped`.
- **FR-007-002**: The system MUST maintain a process registry mapping each PTY to its owning lane, session, and terminal instance.
- **FR-007-003**: The system MUST support spawn, resize, write-input, read-output, and terminate operations on PTY instances.
- **FR-007-004**: The system MUST deliver POSIX signals (SIGTERM, SIGKILL, SIGWINCH, SIGHUP) to PTY child processes and reflect signal outcomes in state transitions.
- **FR-007-005**: The system MUST enforce bounded output buffers with explicit backpressure when consumers fall behind.
- **FR-007-006**: The system MUST publish PTY lifecycle events (spawned, state-changed, output, error, stopped) to the local bus.
- **FR-007-007**: The system MUST support configurable grace periods for SIGTERM-to-SIGKILL escalation.
- **FR-007-008**: The system MUST detect orphaned PTY processes on startup and reconcile them with the process registry.

### Non-Functional Requirements

- **NFR-007-001**: PTY spawn-to-active latency MUST be p95 < 500ms on the baseline hardware profile.
- **NFR-007-002**: Input-to-PTY-write latency MUST be p50 < 5ms, p95 < 15ms (PTY layer only, excluding rendering).
- **NFR-007-003**: The PTY layer MUST support at least 300 concurrent active PTYs within the memory envelope defined in the constitution (< 500 MB total steady-state for 25 active terminals).
- **NFR-007-004**: PTY output buffers MUST apply backpressure before exceeding a configurable per-PTY memory ceiling (default 4 MB).

### Key Entities

- **PTY Instance**: A pseudo-terminal process with file descriptors, dimensions, environment, and lifecycle state.
- **PTY State Machine**: The set of valid states and transitions governing PTY behavior from creation to cleanup.
- **Process Registry**: An in-memory index mapping PTY IDs to lane, session, terminal, and process metadata.
- **Signal Envelope**: A structured record of signal delivery attempts and outcomes for auditability.

## Success Criteria *(mandatory)*

- **SC-007-001**: 99% of PTY spawn requests succeed on first attempt under normal resource availability.
- **SC-007-002**: 100% of PTY failures are isolated to the affected PTY -- no sibling PTYs or global runtime impact.
- **SC-007-003**: Orphaned PTY detection and cleanup completes within 10 seconds of startup reconciliation.
- **SC-007-004**: All PTY lifecycle transitions are published to the bus with correct correlation IDs.

## Assumptions

- The host OS provides standard POSIX PTY support (openpty/forkpty or equivalent).
- The local bus (spec 002) is operational before any PTY spawn is attempted.
- Lane and session identifiers are provided by upstream orchestration (specs 001, 008) at spawn time.
