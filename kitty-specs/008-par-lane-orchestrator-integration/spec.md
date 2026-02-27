# Feature Specification: Par Lane Orchestrator Integration

**Feature Branch**: `008-par-lane-orchestrator-integration`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 001 (Control Plane), 002 (Local Bus), 003 (Workspace/Project), 005 (ID Standards), 007 (PTY Lifecycle)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Run Isolated Work Lanes (Priority: P1)

As an operator, I can create work lanes that provision git worktrees and map to par tasks so each lane executes in an isolated, reproducible context.

**Why this priority**: Lane-based isolation is the fundamental execution model for parallel agent and human work.

**Independent Test**: Create a lane, verify a git worktree is provisioned, confirm a par task is bound, run a command in the lane, and verify output is attributed to the correct lane.

**Acceptance Scenarios**:

1. **Given** a workspace with a git repository, **When** a lane create request is issued, **Then** the system provisions a git worktree, binds a par task, and the lane transitions to `ready` within 5 seconds.
2. **Given** a lane in `ready` state, **When** a command execution is requested, **Then** the lane transitions to `running` and the command executes within the lane's worktree context.
3. **Given** a lane in `running` state, **When** the command completes, **Then** the lane transitions back to `ready` and the completion event is published on the bus.

---

### User Story 2 - Lane Cleanup and Resource Recovery (Priority: P1)

As an operator, I can close lanes and have the system clean up worktrees and par tasks so resources are recovered predictably.

**Why this priority**: Without reliable cleanup, worktree and process accumulation degrades the system over time.

**Independent Test**: Create a lane, run work, request cleanup, and verify the worktree is removed and par task is terminated.

**Acceptance Scenarios**:

1. **Given** a lane in any non-`cleaning` state, **When** cleanup is requested, **Then** the lane transitions through `cleaning` to `closed`, the worktree is removed, and the par task is terminated.
2. **Given** a lane with active PTYs, **When** cleanup is requested, **Then** all PTYs receive graceful termination before worktree removal begins.

---

### User Story 3 - Lane Sharing Between Agents (Priority: P2)

As an operator coordinating multiple agents, I can mark a lane as shared so that multiple agents can attach to it concurrently.

**Why this priority**: Multi-agent collaboration within a single worktree is a key workflow for agent-centric development.

**Independent Test**: Create a lane, mark it shared, attach a second agent, and verify both can execute commands without conflict.

**Acceptance Scenarios**:

1. **Given** a lane in `ready` or `running` state, **When** the operator sets the lane to `shared`, **Then** the lane transitions to `shared` and multiple agents can attach.
2. **Given** a `shared` lane, **When** all agents detach, **Then** the lane returns to `ready`.

---

### Edge Cases

- What happens when worktree provisioning fails mid-lane-create? The lane must transition to `closed` with a diagnostic event; partial worktrees must be cleaned up.
- How does the system handle a par task that becomes unresponsive? The system must detect the stall, escalate to force-kill, and transition the lane to `cleaning`.
- What happens when cleanup is requested on a lane that is already cleaning? The system must treat duplicate cleanup requests as idempotent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-008-001**: The system MUST manage lanes through a state machine: `new` -> `provisioning` -> `ready` -> `running` -> `blocked` -> `shared` -> `cleaning` -> `closed`.
- **FR-008-002**: The system MUST provision a git worktree for each lane, rooted in the workspace repository, during the `provisioning` phase.
- **FR-008-003**: The system MUST bind each lane to a par task for execution isolation and lifecycle tracking.
- **FR-008-004**: The system MUST publish lane lifecycle events (created, state-changed, shared, cleaning, closed) to the local bus.
- **FR-008-005**: The system MUST clean up git worktrees and terminate par tasks when a lane transitions to `closed`.
- **FR-008-006**: The system MUST gracefully terminate all PTYs owned by a lane before beginning worktree cleanup.
- **FR-008-007**: The system MUST support marking lanes as `shared` for multi-agent concurrent access.
- **FR-008-008**: The system MUST detect and reconcile orphaned lanes (worktrees without lane records, or lane records without worktrees) on startup.

### Non-Functional Requirements

- **NFR-008-001**: Lane provisioning (create through `ready`) MUST complete in p95 < 5 seconds for repositories under 1 GB.
- **NFR-008-002**: Lane cleanup MUST complete in p95 < 10 seconds including worktree removal and par task termination.
- **NFR-008-003**: The system MUST support at least 50 concurrent lanes on the baseline hardware profile.
- **NFR-008-004**: Lane state transitions MUST be serialized per lane to prevent race conditions; cross-lane operations MUST remain independent.

### Key Entities

- **Lane**: An isolated execution track with lifecycle state, bound worktree path, par task reference, and owning workspace.
- **Lane State Machine**: Valid states and transitions from `new` through `closed`.
- **Par Task Binding**: The association between a lane and its par-managed execution context.
- **Worktree Record**: Metadata tracking the provisioned git worktree path, base branch, and cleanup status.

## Success Criteria *(mandatory)*

- **SC-008-001**: 95% of lane create/attach operations succeed on first attempt under normal conditions.
- **SC-008-002**: 100% of lane cleanup operations leave no orphaned worktrees or par tasks.
- **SC-008-003**: Lane lifecycle events are published with correct lane and workspace correlation in 100% of transitions.
- **SC-008-004**: Orphaned lane reconciliation completes within 30 seconds of startup.

## Assumptions

- Git is available on the host and the workspace repository supports worktree operations.
- Par is installed and available as a system-level executable.
- The local bus (spec 002) is operational before lane operations begin.
- PTY lifecycle (spec 007) is available for graceful terminal teardown during lane cleanup.
