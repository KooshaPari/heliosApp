# Feature Specification: App Settings and Feature Flags

**Feature Branch**: `004-app-settings-and-feature-flags`
**Created**: 2026-02-27
**Status**: Draft

## Overview

Settings substrate for heliosApp. Scope: user settings persistence, feature flags (starting with `renderer_engine`), hot-reload for config changes, schema validation, and default values. This spec owns the settings data model and change propagation — not the UI for editing settings (001) or the bus transport (002).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View and Change Settings (Priority: P0)

As an operator, I can view current settings and change them so that the app behaves according to my preferences.

**Why this priority**: Settings are the primary mechanism for user customization.

**Independent Test**: Read default settings, change a value, verify the change persists across restart.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user queries settings, **Then** all settings return their schema-defined default values.
2. **Given** a setting change, **When** the user updates `renderer_engine` from `ghostty` to `rio`, **Then** the change is persisted and the new value is returned on subsequent reads.
3. **Given** an invalid setting value, **When** the user attempts to set it, **Then** the system rejects the change with a schema validation error.

---

### User Story 2 — Hot-Reload on Config Change (Priority: P1)

As an operator, I can change settings and see their effect without restarting the app.

**Why this priority**: Restart-to-apply settings are a poor UX; hot-reload is expected in modern desktop apps.

**Acceptance Scenarios**:

1. **Given** a setting flagged as hot-reloadable, **When** the user changes it, **Then** all subscribed subsystems receive the new value within 500ms without restart.
2. **Given** a setting flagged as requires-restart, **When** the user changes it, **Then** the system persists the value and displays a "restart required" indicator.

---

### User Story 3 — Feature Flags (Priority: P1)

As a developer, I can gate functionality behind feature flags so that incomplete or experimental features can be toggled safely.

**Why this priority**: Dual-renderer support and phased rollout require runtime feature toggling.

**Acceptance Scenarios**:

1. **Given** a feature flag `renderer_engine` set to `ghostty`, **When** a subsystem queries it, **Then** it receives `ghostty` as the active renderer.
2. **Given** a feature flag is toggled, **When** the bus event `settings.changed` fires, **Then** all subscribers receive the flag name and new value.

---

### Edge Cases

- Settings file deleted on disk while app is running must be detected and re-persisted from in-memory state.
- Concurrent setting writes from multiple windows must be serialized and last-write-wins with conflict logging.
- Unknown keys in a settings file (e.g., from a newer version) must be preserved, not stripped.
- Feature flag evaluation must have zero allocation overhead on the hot path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a typed settings schema with default values for all settings.
- **FR-002**: The system MUST validate all setting values against the schema before acceptance.
- **FR-003**: The system MUST persist settings to local storage (JSON file in app data directory).
- **FR-004**: The system MUST restore settings from persisted storage on app startup.
- **FR-005**: The system MUST support hot-reload: settings marked `hot_reload: true` propagate to subscribers without restart.
- **FR-006**: The system MUST support restart-required settings: changes are persisted but flagged with a "restart required" indicator.
- **FR-007**: The system MUST emit `settings.changed` events via the bus (spec 002) when any setting is modified.
- **FR-008**: The system MUST provide a feature flag subsystem that exposes flag values as typed queries.
- **FR-009**: The system MUST define `renderer_engine` as a feature flag with values `ghostty` (default) and `rio`.
- **FR-010**: The system MUST preserve unknown keys in the settings file to support forward compatibility.

### Non-Functional Requirements

- **NFR-001**: Settings read (in-memory lookup) MUST be < 0.01ms (p95) — zero-allocation hot path.
- **NFR-002**: Settings write (validate + persist) MUST complete in < 50ms (p95).
- **NFR-003**: Hot-reload propagation MUST reach all subscribers within 500ms (p95) of write.
- **NFR-004**: Settings file size MUST be < 100 KB for up to 200 settings.

### Dependencies

- **Spec 002** (Local Bus): Settings change events published through the bus.

## Key Entities

- **Settings Schema**: Typed definition of all settings with names, types, defaults, validation rules, and reload policy (hot/restart).
- **Setting Value**: Persisted user override for a schema-defined setting.
- **Feature Flag**: Boolean or enum setting used to gate functionality at runtime.
- **Settings Store**: Persistence layer managing JSON file I/O, in-memory cache, and change detection.

## Success Criteria *(mandatory)*

- **SC-001**: Fresh install returns correct default values for 100% of schema-defined settings.
- **SC-002**: Invalid value rejection tests produce schema validation errors in 100% of cases.
- **SC-003**: Hot-reload propagation confirmed within 500ms for all hot-reloadable settings in integration tests.
- **SC-004**: Settings survive app restart with 100% fidelity in persistence round-trip tests.
- **SC-005**: Feature flag read latency < 0.01ms confirmed in microbenchmarks under load.

## Assumptions

- Settings are per-installation, not per-workspace (workspace-specific overrides are post-MVP).
- JSON is the persistence format; migration to SQLite aligns with spec 003 durability phase.
- Feature flags are static configuration, not remote-controlled; remote flag service is post-MVP.
- The initial flag set is small (< 10 flags); the system should scale to 200 settings total.
