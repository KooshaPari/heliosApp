# Feature Specification: Renderer Engine Settings Control

**Feature Branch**: `018-renderer-engine-settings-control`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 004, 010, 013

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Renderer Engine in Settings (Priority: P1)

As an operator, I can open a settings panel and choose between ghostty and rio as my terminal renderer so I can use the engine that best fits my workflow.

**Why this priority**: Renderer selection is a core differentiator of the dual-renderer architecture; it must be accessible and clear.

**Independent Test**: Can be tested by opening the settings panel, selecting each renderer option, and verifying the selection is persisted and reflected in the active renderer.

**Acceptance Scenarios**:

1. **Given** the settings panel is open, **When** the user views the renderer section, **Then** ghostty and rio are listed with their current availability status.
2. **Given** ghostty is the active renderer, **When** the user selects rio and confirms, **Then** the renderer switch transaction (spec 013) is triggered.
3. **Given** the user selects a renderer, **When** the selection is confirmed, **Then** the preference is persisted and used on next startup.

---

### User Story 2 - View Renderer Capabilities (Priority: P2)

As an operator, I can see the capabilities of each renderer (hot-swap support, feature set, version) so I can make an informed choice before switching.

**Why this priority**: Informed renderer selection prevents surprise failures and sets correct expectations about switch behavior.

**Independent Test**: Can be tested by reading capability declarations for each renderer and verifying the settings panel displays them accurately.

**Acceptance Scenarios**:

1. **Given** the settings panel renderer section, **When** the user expands a renderer entry, **Then** its capabilities are displayed (version, hot-swap support, supported features).
2. **Given** a renderer that does not support hot-swap, **When** the user views its capabilities, **Then** a clear indication states that switching will require restart-with-restore.

---

### User Story 3 - Monitor Switch Status (Priority: P1)

As an operator, when a renderer switch is in progress, I can see real-time status indicators in the settings panel so I know whether the switch is proceeding, has succeeded, or has failed.

**Why this priority**: A switch that takes seconds with no feedback creates anxiety and may lead the user to interrupt the process.

**Independent Test**: Can be tested by triggering a renderer switch and verifying the settings panel shows progress indicators through each transaction phase.

**Acceptance Scenarios**:

1. **Given** a renderer switch is in progress, **When** the user views the settings panel, **Then** a status indicator shows the current phase (initializing, swapping, committing).
2. **Given** a switch fails and rolls back, **When** the rollback completes, **Then** the settings panel shows the failure reason and confirms the original renderer is active.
3. **Given** a switch succeeds, **When** the transaction commits, **Then** the settings panel updates to show the new renderer as active.

---

### User Story 4 - Toggle Hot-Swap Preference (Priority: P3)

As an operator, I can toggle a preference to prefer hot-swap or always use restart-with-restore so I can prioritize speed or reliability based on my comfort level.

**Why this priority**: Power users may prefer the reliability of restart-with-restore even when hot-swap is available.

**Independent Test**: Can be tested by setting the preference to "always restart," triggering a switch between hot-swap-capable renderers, and verifying restart-with-restore is used.

**Acceptance Scenarios**:

1. **Given** hot-swap preference is enabled (default), **When** both renderers support hot-swap, **Then** hot-swap is used for the switch.
2. **Given** hot-swap preference is disabled, **When** both renderers support hot-swap, **Then** restart-with-restore is used instead.

---

### Edge Cases

- What happens when a renderer becomes unavailable after being selected? The system MUST display an unavailable status and prevent switch attempts until availability is restored.
- What happens when settings are changed during an active switch? The system MUST lock the renderer settings section during an active transaction and display the in-progress indicator.
- What happens when the user has never configured a renderer preference? The system MUST default to ghostty with hot-swap enabled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-018-001**: The system MUST provide a settings panel section for renderer engine selection.
- **FR-018-002**: The system MUST display both ghostty and rio with their availability status and capability summary.
- **FR-018-003**: The system MUST require user confirmation before triggering a renderer switch.
- **FR-018-004**: The system MUST trigger the renderer switch transaction (spec 013) upon confirmed selection.
- **FR-018-005**: The system MUST display real-time status indicators during switch transactions (phase, progress, outcome).
- **FR-018-006**: The system MUST provide a hot-swap preference toggle (prefer hot-swap vs. always restart-with-restore).
- **FR-018-007**: The system MUST persist renderer preference and hot-swap toggle across sessions.
- **FR-018-008**: The system MUST lock renderer settings during an active switch transaction.

### Non-Functional Requirements

- **NFR-018-001**: Settings panel renderer section MUST render in under 200ms.
- **NFR-018-002**: Status indicator updates during a switch MUST reflect within 500ms of transaction phase changes.
- **NFR-018-003**: Settings persistence MUST survive runtime restarts and be loaded within 100ms of startup.

### Key Entities

- **Renderer Settings Section**: UI component within the settings panel for renderer engine configuration.
- **Renderer Option**: A selectable renderer entry (ghostty or rio) with availability, version, and capabilities.
- **Hot-Swap Preference**: User toggle controlling whether hot-swap or restart-with-restore is preferred.
- **Switch Status Indicator**: Real-time display of the current switch transaction phase and outcome.
- **Renderer Preference**: Persisted user selection of active renderer engine and hot-swap toggle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-018-001**: Users can select and switch renderers from the settings panel with at least 95% first-attempt success rate.
- **SC-018-002**: 100% of switch transactions show real-time status indicators in the settings panel during test runs.
- **SC-018-003**: Renderer preference persists correctly across 100% of restart cycles in test runs.
- **SC-018-004**: Zero instances of settings becoming editable during an active switch transaction in the test matrix.

## Assumptions

- Renderer capability declarations (spec 010) are available for display in the settings panel.
- Renderer switch transactions (spec 013) are operational and emit phase-change events on the internal bus.
- Feature flags (spec 004) control renderer availability and can be queried by the settings UI.
- ghostty is the default renderer; rio is feature-flagged and may not be available in all builds.
