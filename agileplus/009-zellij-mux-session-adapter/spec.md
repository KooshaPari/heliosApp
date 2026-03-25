# Feature Specification: Zellij Mux Session Adapter

**Feature Branch**: `009-zellij-mux-session-adapter`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 001 (Control Plane), 002 (Local Bus), 007 (PTY Lifecycle), 008 (Par Lane Orchestrator)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multiplexed Terminal Sessions Within Lanes (Priority: P1)

As an operator, I can have multiple terminal panes within a single lane so that I can view logs, run builds, and interact with agents side by side.

**Why this priority**: Multi-pane layout within a lane is a core daily workflow for terminal-centric development.

**Independent Test**: Create a lane, open a zellij session with multiple panes, verify each pane is independently interactive, and confirm all panes are bound to the same lane.

**Acceptance Scenarios**:

1. **Given** a lane in `ready` state, **When** a mux session is requested, **Then** a zellij session is created and bound to the lane with an initial single-pane layout.
2. **Given** an active mux session, **When** the operator requests a new pane, **Then** a pane is added to the session layout and a PTY is spawned for it.
3. **Given** a multi-pane session, **When** the operator closes a pane, **Then** the PTY is terminated, the layout reflows, and a pane-closed event is published.

---

### User Story 2 - Session Persistence Across Restarts (Priority: P1)

As an operator, I expect mux sessions to survive runtime restarts so that pane layouts and running processes are recoverable.

**Why this priority**: Session continuity is foundational to the recovery guarantees in spec 001.

**Independent Test**: Create a session with panes, simulate a restart, and verify the session and pane topology are restored.

**Acceptance Scenarios**:

1. **Given** an active mux session with panes, **When** the runtime restarts, **Then** the zellij session is reattached and pane topology is restored.
2. **Given** a session that cannot be reattached, **When** recovery fails, **Then** the system publishes a recovery-failure event with session and lane identifiers.

---

### User Story 3 - Tab Management Within Sessions (Priority: P2)

As an operator managing complex workflows, I can organize panes into tabs within a mux session for better context separation.

**Why this priority**: Tab organization reduces cognitive load when lanes have many concurrent activities.

**Independent Test**: Create a session, add multiple tabs, verify panes in each tab are independent, and switch between tabs.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the operator creates a new tab, **Then** a tab is added with a default pane and the tab-created event is published.
2. **Given** a session with multiple tabs, **When** the operator switches tabs, **Then** the active tab's panes are displayed and the tab-switched event is published.

---

### Edge Cases

- What happens when zellij is not installed or crashes? The system must detect the absence, surface a clear error, and prevent session creation until zellij is available.
- How does the system handle layout requests that exceed the visible area? The system must enforce minimum pane dimensions and reject splits that would violate them.
- What happens when a session-to-lane binding becomes stale? The system must detect the mismatch during reconciliation and offer rebind or cleanup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-009-001**: The system MUST create, reattach, and terminate zellij sessions through a managed adapter interface.
- **FR-009-002**: The system MUST bind each mux session to exactly one lane and maintain that binding in the session registry.
- **FR-009-003**: The system MUST support pane create, close, and resize operations within a session, each triggering a corresponding PTY lifecycle action.
- **FR-009-004**: The system MUST support tab create, close, and switch operations within a session.
- **FR-009-005**: The system MUST relay mux-level events (session-created, pane-added, pane-closed, tab-created, tab-switched, session-terminated) to the local bus.
- **FR-009-006**: The system MUST support session reattach after runtime restart using zellij's native session persistence.
- **FR-009-007**: The system MUST enforce minimum pane dimensions and reject layout operations that violate them.
- **FR-009-008**: The system MUST reconcile session-to-lane bindings on startup and flag stale or orphaned sessions.

### Non-Functional Requirements

- **NFR-009-001**: Mux session creation MUST complete in p95 < 2 seconds.
- **NFR-009-002**: Pane add/remove operations MUST complete in p95 < 500ms.
- **NFR-009-003**: Session reattach after restart MUST complete in p95 < 3 seconds.
- **NFR-009-004**: The adapter MUST not introduce more than 2ms of additional latency on the PTY data path.

### Key Entities

- **Mux Session**: A zellij session instance bound to a lane, containing tabs and panes.
- **Pane**: A terminal viewport within a mux session, backed by a PTY instance.
- **Tab**: A named group of panes within a mux session for context organization.
- **Session-Lane Binding**: The association record linking a mux session ID to a lane ID.
- **Layout Topology**: The current arrangement of tabs and panes within a session, including dimensions.

## Success Criteria *(mandatory)*

- **SC-009-001**: 95% of session create/reattach operations succeed on first attempt.
- **SC-009-002**: 100% of pane and tab lifecycle events are published to the bus with correct correlation.
- **SC-009-003**: Session reattach restores correct pane topology in 95% of controlled restart tests.
- **SC-009-004**: Zero orphaned zellij sessions remain after startup reconciliation completes.

## Assumptions

- Zellij is installed on the host system and accessible via CLI.
- Zellij's native session persistence is sufficient for reattach; zmx handles higher-level checkpoint/restore.
- The PTY lifecycle manager (spec 007) is available for pane-level PTY operations.
- Lane orchestration (spec 008) provides lane identity before session creation.
