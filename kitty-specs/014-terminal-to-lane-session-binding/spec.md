# Feature Specification: Terminal Registry and Context Binding

**Feature Branch**: `014-terminal-to-lane-session-binding`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 001, 003, 005, 007, 008, 009

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Terminal Has a Home (Priority: P1)

As an operator, every terminal I interact with is always bound to a specific workspace, lane, and session so I always know the execution context of my work.

**Why this priority**: Unbound terminals create ambiguity about which project/lane owns a command, leading to misrouted work and data corruption.

**Independent Test**: Can be tested by creating terminals through various paths (lane creation, session attach, manual open) and verifying each terminal's registry entry contains valid workspace_id, lane_id, and session_id.

**Acceptance Scenarios**:

1. **Given** a new terminal is created, **When** the terminal becomes interactive, **Then** its registry entry contains a valid workspace_id, lane_id, and session_id.
2. **Given** a terminal with an active binding, **When** the user queries the terminal's context, **Then** the returned workspace/lane/session triple matches the actual execution environment.
3. **Given** an attempt to create a terminal without a lane or session, **When** the creation request is processed, **Then** the system rejects the request with a clear error explaining the missing binding.

---

### User Story 2 - Binding Stays Consistent Through Lifecycle (Priority: P1)

As an operator, when I move between lanes or sessions, terminal bindings update consistently so the UI and runtime always agree on which terminal belongs where.

**Why this priority**: Stale or inconsistent bindings cause UI to show wrong context and commands to execute in wrong lanes.

**Independent Test**: Can be tested by performing lane switches, session reattaches, and workspace transitions while continuously polling terminal registry state for consistency.

**Acceptance Scenarios**:

1. **Given** a terminal bound to lane A, **When** the lane is detached, **Then** the terminal binding is updated or the terminal is cleanly closed.
2. **Given** a session reattach after restart, **When** terminals are restored, **Then** each terminal's binding matches the restored session and lane identifiers.
3. **Given** concurrent operations on the same terminal binding, **When** both operations complete, **Then** the final binding state is deterministic and consistent.

---

### User Story 3 - Validate Before Every Operation (Priority: P2)

As the system, before executing any terminal operation, I validate that the terminal's binding is current and consistent so no operation runs against stale context.

**Why this priority**: Pre-operation validation prevents silent failures from stale state.

**Independent Test**: Can be tested by corrupting a terminal's binding record and verifying that subsequent operations are rejected with a validation error.

**Acceptance Scenarios**:

1. **Given** a terminal with a valid binding, **When** an operation is requested, **Then** binding validation passes and the operation proceeds.
2. **Given** a terminal whose lane has been cleaned up, **When** an operation is requested, **Then** binding validation fails and the operation is rejected with an actionable error.

---

### Edge Cases

- What happens when a lane is deleted while its terminals are active? The system MUST close or orphan-flag affected terminals and notify the user.
- What happens when binding metadata is corrupted on disk? The system MUST detect the corruption via checksum validation and trigger remediation via the orphan detection system (spec 015).
- What happens when two terminals claim the same session_id? The system MUST detect the conflict and resolve or reject the duplicate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-014-001**: The system MUST maintain a terminal registry that maps every terminal_id to exactly one (workspace_id, lane_id, session_id) triple.
- **FR-014-002**: The system MUST reject terminal creation when the target lane or session does not exist or is in an invalid lifecycle state.
- **FR-014-003**: The system MUST validate terminal binding consistency before executing any terminal operation.
- **FR-014-004**: The system MUST update or invalidate terminal bindings when the bound lane or session changes lifecycle state (detach, cleanup, terminate).
- **FR-014-005**: The system MUST emit binding lifecycle events (bound, rebound, unbound, validation-failed) on the internal bus.
- **FR-014-006**: The system MUST support querying the registry by any component of the binding triple (workspace, lane, session, or terminal).
- **FR-014-007**: The system MUST enforce uniqueness of terminal_id within the registry.
- **FR-014-008**: The system MUST persist binding state durably so it survives runtime restarts.

### Non-Functional Requirements

- **NFR-014-001**: Binding validation on terminal operations MUST add no more than 5ms overhead at p95.
- **NFR-014-002**: Registry lookups by any key (terminal_id, lane_id, session_id, workspace_id) MUST complete in under 2ms at p95.
- **NFR-014-003**: The registry MUST support at least 1000 concurrent terminal bindings without degradation.

### Key Entities

- **Terminal Registry**: Authoritative store mapping terminal_id to (workspace_id, lane_id, session_id) with lifecycle state.
- **Binding Triple**: The (workspace_id, lane_id, session_id) tuple that defines a terminal's execution context.
- **Binding Lifecycle Event**: Bus event emitted on binding state changes for downstream consumers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-014-001**: 100% of terminals in the system have a valid binding triple at all times during normal operation.
- **SC-014-002**: Zero terminal operations execute against stale or invalid bindings in test harness runs.
- **SC-014-003**: After restart recovery, at least 98% of terminal bindings are restored correctly without manual intervention.
- **SC-014-004**: Registry lookup latency stays under 2ms p95 with 500+ active bindings.

## Assumptions

- Lane and session lifecycle management (specs 008, 009) is operational and emits lifecycle events that the registry can subscribe to.
- The internal event bus (spec 001) is available for binding lifecycle event emission.
- Workspace identity (spec 003) is established before terminal creation.
- Terminal_id generation produces globally unique identifiers.
