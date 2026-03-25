# Feature Specification: Renderer Adapter Interface

**Feature Branch**: `010-renderer-adapter-interface`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 001 (Control Plane / Desktop Shell), 002 (Local Bus), 004 (Configuration), 007 (PTY Lifecycle)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch Renderers Without Losing Work (Priority: P1)

As an operator, I can switch between terminal rendering engines and have the system perform the switch transactionally so that my sessions and panes are preserved.

**Why this priority**: Renderer switching is a constitutional requirement (FR-008 in spec 001) and directly affects daily usability.

**Independent Test**: Start with the default renderer active, request a switch, verify the new renderer initializes, and confirm all terminal sessions remain attached after the switch completes.

**Acceptance Scenarios**:

1. **Given** an active renderer, **When** a renderer switch is requested, **Then** the system stops the current renderer, starts the new one, and rebinds all active PTY streams within 3 seconds.
2. **Given** a renderer switch in progress, **When** the new renderer fails to initialize, **Then** the system rolls back to the previous renderer and publishes a switch-failure event.
3. **Given** no active renderer, **When** the system starts, **Then** the configured default renderer initializes and transitions to `running`.

---

### User Story 2 - Query Renderer Capabilities (Priority: P2)

As the system or an operator, I can query the capability matrix of each registered renderer so that feature availability is known before attempting operations.

**Why this priority**: Capability awareness prevents runtime errors from unsupported features and supports future renderer additions.

**Independent Test**: Query capabilities for each registered renderer and verify the response includes GPU support, maximum dimensions, and supported input modes.

**Acceptance Scenarios**:

1. **Given** a registered renderer, **When** capabilities are queried, **Then** the system returns a structured capability matrix including GPU support, color depth, and input mode flags.
2. **Given** a capability that varies by platform, **When** capabilities are queried on that platform, **Then** the matrix reflects the actual runtime capability, not a static default.

---

### Edge Cases

- What happens when no renderer is registered? The system must refuse to start terminal sessions and surface a clear diagnostic.
- How does the system handle a renderer that crashes mid-frame? The system must detect the crash, attempt restart, and fall back to the alternate renderer if restart fails.
- What happens during a renderer switch when a PTY produces high-throughput output? The switch must buffer or pause output delivery and resume after rebind.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-010-001**: The system MUST define a renderer adapter interface with lifecycle operations: `init`, `start`, `stop`, `switch`, and `queryCapabilities`.
- **FR-010-002**: The system MUST manage renderer state through a state machine: `uninitialized` -> `initializing` -> `running` -> `switching` -> `stopping` -> `stopped` -> `errored`.
- **FR-010-003**: The system MUST maintain a renderer registry where engines register themselves with identity, version, and capability metadata.
- **FR-010-004**: The system MUST perform renderer switches as transactions with automatic rollback on failure.
- **FR-010-005**: The system MUST support binding and unbinding PTY output streams to the active renderer without data loss.
- **FR-010-006**: The system MUST publish renderer lifecycle events (initialized, started, switched, stopped, errored) to the local bus.
- **FR-010-007**: The system MUST report a structured capability matrix per renderer including at minimum: GPU acceleration, color depth, ligature support, maximum dimensions, and input modes.
- **FR-010-008**: The system MUST enforce that exactly one renderer is active at any time during normal operation.

### Non-Functional Requirements

- **NFR-010-001**: Renderer switch (stop old, start new, rebind streams) MUST complete in p95 < 3 seconds.
- **NFR-010-002**: The adapter interface MUST not add more than 1 frame of latency (< 16.7ms at 60 FPS) to the render path.
- **NFR-010-003**: Capability queries MUST return in p95 < 50ms.
- **NFR-010-004**: The adapter abstraction MUST support addition of new renderer backends without modification to the core interface contract.

### Key Entities

- **Renderer Adapter**: The interface contract that all renderer backends must implement.
- **Renderer Registry**: The collection of registered renderer backends with their metadata and capabilities.
- **Renderer State Machine**: Valid states and transitions for renderer lifecycle management.
- **Capability Matrix**: Structured description of a renderer's supported features and limits.
- **Stream Binding**: The association between a PTY output stream and the active renderer for frame production.

## Success Criteria *(mandatory)*

- **SC-010-001**: 100% of renderer switches either complete successfully or roll back cleanly with no orphaned state.
- **SC-010-002**: Both ghostty and rio backends can register and pass capability queries without interface modifications.
- **SC-010-003**: PTY output continuity is maintained through renderer switches with zero data loss in controlled tests.
- **SC-010-004**: Renderer crash recovery (restart or fallback) completes within 5 seconds in 95% of test scenarios.

## Assumptions

- Exactly two renderer backends (ghostty, rio) are planned for MVP; the interface should support N backends.
- The ElectroBun shell (spec 001) provides the window/surface into which renderers draw.
- PTY streams (spec 007) are the sole input source for terminal rendering.
- Configuration (spec 004) provides the user's default renderer preference.
