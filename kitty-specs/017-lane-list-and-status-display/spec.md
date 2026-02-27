# Feature Specification: Lane Manager Panel

**Feature Branch**: `017-lane-list-and-status-display`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 005, 008, 009, 015

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See All Lanes at a Glance (Priority: P1)

As an operator managing multiple parallel work tracks, I can see a left-rail lane list with real-time health indicators so I know the state of every lane without clicking into each one.

**Why this priority**: Without at-a-glance lane visibility, operators lose track of parallel work and miss blocked or errored lanes.

**Independent Test**: Can be tested by creating lanes in various states (idle, running, blocked, error, shared), opening the lane panel, and verifying each lane displays the correct status badge with the correct color.

**Acceptance Scenarios**:

1. **Given** 5 lanes in different lifecycle states, **When** the user opens the lane panel, **Then** each lane is listed with a status badge matching its current state.
2. **Given** a lane transitions from running to error, **When** the transition event fires, **Then** the lane panel updates the badge color within 1 second without user action.
3. **Given** a lane in shared state (collaboration active), **When** the user views the lane list, **Then** a distinct shared indicator is visible.

---

### User Story 2 - Manage Lanes from the Panel (Priority: P1)

As an operator, I can create, attach to, and clean up lanes directly from the lane panel so I do not need to use CLI commands for common lane operations.

**Why this priority**: GUI-accessible lane management reduces friction for the core workflow of creating and switching between work tracks.

**Independent Test**: Can be tested by performing full lane lifecycle (create, attach, detach, cleanup) entirely from the lane panel UI and verifying each action completes successfully.

**Acceptance Scenarios**:

1. **Given** the lane panel is open, **When** the user clicks the create action, **Then** a new lane is created with a default name and appears in the list within 2 seconds.
2. **Given** an idle lane in the list, **When** the user selects attach, **Then** the active context switches to that lane and all tabs update.
3. **Given** an orphan-flagged lane, **When** the user selects cleanup, **Then** the system presents a confirmation dialog before executing cleanup.

---

### User Story 3 - Real-Time Status Updates (Priority: P2)

As an operator, lane status badges update in real time based on bus events so the panel always reflects current system state without manual refresh.

**Why this priority**: Stale status indicators lead to incorrect operator decisions.

**Independent Test**: Can be tested by programmatically emitting state-change events and verifying the panel reflects each change within the specified latency.

**Acceptance Scenarios**:

1. **Given** the lane panel is visible, **When** a lane state-change event is emitted on the bus, **Then** the panel updates within 1 second.
2. **Given** rapid state transitions on a single lane, **When** all transitions complete, **Then** the panel shows the final state without displaying intermediate states that could mislead.

---

### Edge Cases

- What happens when there are more lanes than fit in the panel? The system MUST provide scrolling with sticky grouping headers (by workspace if applicable).
- What happens when a lane is deleted externally (e.g., via CLI)? The system MUST remove the lane from the panel within one bus event cycle.
- What happens when the bus is temporarily unavailable? The system MUST display a "status may be stale" indicator until bus connectivity is restored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-017-001**: The system MUST display a left-rail lane list panel showing all lanes in the active workspace.
- **FR-017-002**: Each lane entry MUST display a status badge with distinct colors for idle, running, blocked, error, and shared states.
- **FR-017-003**: The system MUST provide lane create, attach, and cleanup actions accessible from the panel.
- **FR-017-004**: Cleanup actions MUST require user confirmation before execution.
- **FR-017-005**: The system MUST update lane status badges in real time via internal bus event subscription.
- **FR-017-006**: The system MUST integrate with orphan detection (spec 015) to flag orphaned lanes with a distinct visual indicator.
- **FR-017-007**: The system MUST support keyboard navigation within the lane list (arrow keys to select, Enter to attach).

### Non-Functional Requirements

- **NFR-017-001**: Lane panel rendering MUST complete initial paint in under 300ms for up to 50 lanes.
- **NFR-017-002**: Status badge updates from bus events MUST reflect in the UI within 1 second at p95.
- **NFR-017-003**: Lane panel MUST NOT block the main UI thread during updates.

### Key Entities

- **Lane Panel**: Left-rail UI component displaying all lanes in the active workspace with status and actions.
- **Status Badge**: Color-coded indicator (idle=gray, running=green, blocked=yellow, error=red, shared=blue) representing lane health. The panel MUST display user-facing status derived from the full lane state machine (spec 008). States `provisioning` and `cleaning` MUST map to a visible 'busy' indicator. State `closed` MUST remove the lane from the active list or show a 'closed' badge.
- **Lane Action**: User-triggered operation (create, attach, detach, cleanup) accessible from the panel.
- **Lane State Event**: Bus event consumed by the panel to drive real-time badge updates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-017-001**: 100% of lane state transitions are reflected in the panel within 1 second in test runs.
- **SC-017-002**: Users complete lane create/attach/cleanup workflows from the panel with at least 95% first-attempt success rate.
- **SC-017-003**: Lane panel renders correctly with 50 lanes in under 300ms in performance test runs.
- **SC-017-004**: Zero instances of stale status badges persisting more than 2 seconds after a state change event in the test matrix.

## Assumptions

- Lane lifecycle management (spec 008) and session lifecycle management (spec 009) emit state-change events on the internal bus.
- Orphan detection (spec 015) provides a queryable list of flagged orphaned lanes.
- The ElectroBun UI framework supports left-rail panel components with dynamic content updates.
- Status badge color scheme is configurable via theme settings.
