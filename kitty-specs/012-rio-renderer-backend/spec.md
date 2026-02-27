# Feature Specification: Rio Renderer Backend

**Feature Branch**: `012-rio-renderer-backend`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 010 (Renderer Adapter Interface)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Feature-Flagged Alternative Renderer (Priority: P2)

As an operator, I can opt into the rio rendering engine via a feature flag so that I have an alternative if ghostty is unavailable or unsuitable for my environment.

**Why this priority**: Rio is the secondary renderer, feature-flagged off by default; it provides redundancy but is not the primary path.

**Independent Test**: Enable the rio feature flag, switch to rio, verify terminal output renders correctly, and confirm input latency meets acceptable thresholds.

**Acceptance Scenarios**:

1. **Given** the rio feature flag is enabled, **When** a renderer switch to rio is requested, **Then** rio initializes, renders terminal output, and reports `running` state.
2. **Given** the rio feature flag is disabled (default), **When** a renderer switch to rio is requested, **Then** the system rejects the request with a clear error indicating the flag is required.
3. **Given** rio is the active renderer, **When** the operator types input, **Then** input-to-echo latency is p50 < 30ms and p95 < 60ms.

---

### User Story 2 - Rio Lifecycle and Crash Recovery (Priority: P2)

As the system, I can manage rio's process lifecycle and recover from crashes so that the renderer adapter's recovery guarantees hold.

**Why this priority**: Even as a secondary renderer, crash recovery is needed to maintain system reliability when rio is active.

**Independent Test**: Start rio, force-crash it, verify the adapter detects the crash and either restarts rio or falls back to ghostty.

**Acceptance Scenarios**:

1. **Given** rio in `running` state, **When** the rio process crashes, **Then** the adapter publishes a renderer-errored event and initiates recovery within 500ms.
2. **Given** rio recovery fails, **When** ghostty is available, **Then** the system falls back to ghostty and publishes a fallback event.

---

### User Story 3 - Frame Metrics Parity (Priority: P3)

As the system, I collect the same frame metrics from rio as from ghostty so that performance monitoring is renderer-agnostic.

**Why this priority**: Consistent metrics enable apples-to-apples comparison between renderers.

**Independent Test**: Enable rio with metrics, run terminal output, and verify the same metric categories (frame time, FPS, input latency) are published.

**Acceptance Scenarios**:

1. **Given** rio is active with metrics enabled, **When** frames are rendered, **Then** frame time, FPS, and input latency metrics are published using the same schema as ghostty.

---

### Edge Cases

- What happens when the rio feature flag is toggled while rio is the active renderer? The system must stop rio gracefully and switch to ghostty before disabling the flag takes effect.
- How does the system handle rio versions that have different capability profiles than ghostty? The capability matrix must accurately reflect rio's actual features so the adapter and operator can make informed choices.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-012-001**: The rio backend MUST implement the same renderer adapter interface defined in spec 010.
- **FR-012-002**: The rio backend MUST be gated behind a feature flag that is off by default.
- **FR-012-003**: The backend MUST embed or manage the rio process/library and bind its render loop to the ElectroBun window surface.
- **FR-012-004**: The backend MUST pipe PTY output streams to rio for rendering and relay user input from rio back to the PTY.
- **FR-012-005**: The backend MUST collect and publish frame metrics using the same schema as the ghostty backend.
- **FR-012-006**: The backend MUST report its capability matrix accurately, reflecting actual runtime feature availability.
- **FR-012-007**: The backend MUST handle rio process crashes by publishing an error event and supporting adapter-level recovery or fallback.
- **FR-012-008**: The system MUST reject renderer switch requests to rio when the feature flag is disabled.

### Non-Functional Requirements

- **NFR-012-001**: Input-to-echo latency MUST meet p50 < 30ms, p95 < 60ms when rio is active.
- **NFR-012-002**: Input-to-render latency MUST meet p50 < 60ms, p95 < 150ms when rio is active.
- **NFR-012-003**: The renderer MUST sustain 60 FPS on the active pane under normal output load.
- **NFR-012-004**: The rio integration MUST not increase per-terminal memory footprint by more than 10 MB beyond baseline PTY allocation.
- **NFR-012-005**: When the feature flag is disabled, rio code MUST have zero runtime cost (no process spawned, no memory allocated).

### Key Entities

- **Rio Process/Library**: The rio rendering engine instance managed by this backend.
- **Feature Flag**: The configuration toggle controlling rio availability at runtime.
- **Render Surface Binding**: The association between rio's render output and the ElectroBun window region.
- **Input Passthrough**: The bidirectional channel connecting rio's input handling to the PTY write path.
- **Frame Metrics**: Structured performance data using the same schema as the ghostty backend.

## Success Criteria *(mandatory)*

- **SC-012-001**: Rio meets all constitutional rendering SLOs when active in benchmark tests on baseline hardware.
- **SC-012-002**: Rio registers with the renderer adapter and passes capability queries using the same interface as ghostty.
- **SC-012-003**: Renderer switch between ghostty and rio preserves all active sessions in 100% of controlled tests.
- **SC-012-004**: With the feature flag disabled, zero rio-related processes or memory allocations are present at runtime.

## Assumptions

- Rio is available as a library or embeddable process with a documented integration API.
- The renderer adapter interface (spec 010) is the same contract ghostty implements; rio must conform to it without modifications.
- Rio is not required for MVP launch; it is an optional secondary renderer for flexibility and redundancy.
- Feature flag infrastructure (spec 004 or equivalent) is available before rio integration.
