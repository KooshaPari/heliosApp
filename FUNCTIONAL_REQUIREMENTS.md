# Functional Requirements — heliosApp

**Version:** 1.0
**Status:** Draft
**Date:** 2026-03-25
**Traces to:** PRD.md (heliosApp epics E1–E5)

---

## Categories

| Code | Domain |
|------|--------|
| UI | UI components and desktop shell |
| CHAT | Chat and agent interaction system |
| LANE | Lane and panel orchestration |
| KEY | Keyboard shortcuts and bindings |
| CONF | Configuration and feature flags |
| PERF | Performance and quality gates |

---

## FR-UI-001: Tauri Desktop Shell Bootstrap

**Priority**: SHALL
**Description**: The application SHALL launch as a native Tauri desktop window with a TypeScript renderer that initializes the runtime connection.
**Acceptance Criteria**:
- [ ] Tauri window opens within 2 seconds of launch
- [ ] TypeScript renderer mounts and connects to local bus before first paint
- [ ] Window title reflects current workspace name
**Traces to**: E2.1
**Status**: Partial

---

## FR-UI-002: Terminal Rendering Component

**Priority**: SHALL
**Description**: The UI SHALL render PTY output in a terminal component that supports ANSI escape sequences and cursor positioning.
**Acceptance Criteria**:
- [ ] Terminal component renders all standard ANSI color codes
- [ ] Cursor position updates are reflected within one render frame
- [ ] Scrollback buffer retains at least 10,000 lines
**Traces to**: E2.1
**Status**: Partial

---

## FR-UI-003: Workspace Visual Overview

**Priority**: SHALL
**Description**: The UI SHALL display an overview panel listing all active workspaces with their lane counts and session states.
**Acceptance Criteria**:
- [ ] All workspaces enumerated from runtime state on load
- [ ] Lane count and active/idle/error state shown per workspace
- [ ] Clicking a workspace sets it as the active context
**Traces to**: E1.2
**Status**: Planned

---

## FR-UI-004: Session State Indicator

**Priority**: SHALL
**Description**: Each lane panel SHALL display a visual state indicator reflecting the underlying session's lifecycle state.
**Acceptance Criteria**:
- [ ] States rendered: idle, attaching, attached, detaching, error
- [ ] State transitions animate without full panel re-render
- [ ] Error state displays the last error message inline
**Traces to**: E1.3
**Status**: Planned

---

## FR-UI-005: Audit Log Viewer

**Priority**: SHOULD
**Description**: The UI SHOULD provide a scrollable, filterable audit log viewer showing all captured bus events.
**Acceptance Criteria**:
- [ ] Events displayed in reverse-chronological order
- [ ] Filter by event type (command, event, response)
- [ ] Clicking an event expands full payload details
**Traces to**: E4.1
**Status**: Planned

---

## FR-CHAT-001: Agent Chat Input

**Priority**: SHALL
**Description**: The application SHALL provide a chat input panel for sending prompts to the active agent session attached to a lane.
**Acceptance Criteria**:
- [ ] Input field accepts multi-line text with Shift+Enter for newlines
- [ ] Enter key submits the prompt to the active lane session
- [ ] Input is disabled and visually locked while a response is in flight
**Traces to**: E2.1
**Status**: Partial

---

## FR-CHAT-002: Streamed Response Display

**Priority**: SHALL
**Description**: The chat panel SHALL display agent responses as a live stream, appending tokens incrementally as they arrive over the local bus.
**Acceptance Criteria**:
- [ ] First token renders within 200 ms of stream start
- [ ] Tokens append without reflowing previously rendered content
- [ ] Stream completion triggers a visual "done" indicator
**Traces to**: E1.1
**Status**: Partial

---

## FR-CHAT-003: Conversation History Persistence

**Priority**: SHALL
**Description**: Chat conversation history for each lane SHALL be persisted to disk and restored on application restart.
**Acceptance Criteria**:
- [ ] History written to session file on each exchange completion
- [ ] History loaded and displayed on lane reopen
- [ ] Maximum 1,000 exchanges retained per lane; older entries pruned
**Traces to**: E4.1
**Status**: Planned

---

## FR-CHAT-004: Provider Routing Indicator

**Priority**: SHOULD
**Description**: The chat panel SHOULD display which provider adapter fulfilled each response, including model name and latency.
**Acceptance Criteria**:
- [ ] Provider name shown in response metadata footer
- [ ] Response latency shown in milliseconds
- [ ] Failed routing attempts shown with fallback provider name
**Traces to**: E3.1
**Status**: Planned

---

## FR-LANE-001: Lane Create and Destroy

**Priority**: SHALL
**Description**: Users SHALL be able to create and destroy lanes within a workspace from the UI without restarting the application.
**Acceptance Criteria**:
- [ ] "New Lane" action creates a lane and binds it to a fresh session
- [ ] "Close Lane" destroys the lane, detaches the session, and removes the panel
- [ ] Destroyed lane state is not recoverable (no undo)
**Traces to**: E1.2
**Status**: Partial

---

## FR-LANE-002: Parallel Lane Execution

**Priority**: SHALL
**Description**: The runtime SHALL support PAR lane groups where multiple lanes execute concurrently within the same workspace.
**Acceptance Criteria**:
- [ ] PAR group can contain 2-8 lanes
- [ ] All lanes in a PAR group show independent terminal output simultaneously
- [ ] Workspace bus routes commands to all PAR members in parallel
**Traces to**: E1.2
**Status**: Partial

---

## FR-LANE-003: Lane-to-Session Binding

**Priority**: SHALL
**Description**: Each lane SHALL maintain a durable binding to a session, with binding state tracked via a state machine.
**Acceptance Criteria**:
- [ ] Binding states: unbound, binding, bound, error
- [ ] Bound state requires a live PTY process
- [ ] Error state exposes reason and allows rebind without destroying the lane
**Traces to**: E1.3
**Status**: Partial

---

## FR-LANE-004: Zellij Multiplexer Integration

**Priority**: SHOULD
**Description**: Sessions SHOULD use the Zellij mux adapter for terminal multiplexing when Zellij is available on the host.
**Acceptance Criteria**:
- [ ] Adapter detected at startup; fallback to raw PTY if absent
- [ ] Zellij pane IDs tracked per lane binding
- [ ] Split-pane layout preserved across session reattach
**Traces to**: E1.3
**Status**: Planned

---

## FR-LANE-005: Lane Drag-and-Drop Reorder

**Priority**: MAY
**Description**: Users MAY reorder lanes within a workspace by dragging panels to new positions.
**Acceptance Criteria**:
- [ ] Drag handle visible on lane panel header hover
- [ ] Drop target highlights valid positions
- [ ] Order persisted to workspace state on drop
**Traces to**: E1.2
**Status**: Planned

---

## FR-KEY-001: Global Shortcut Map

**Priority**: SHALL
**Description**: The application SHALL provide a documented global keyboard shortcut map for all primary navigation and action commands.
**Acceptance Criteria**:
- [ ] At minimum: new lane, close lane, switch workspace, toggle audit log, submit chat
- [ ] Shortcuts documented in a help overlay accessible via the '?' key
- [ ] No shortcut conflicts with terminal pass-through keys
**Traces to**: E2.1
**Status**: Planned

---

## FR-KEY-002: Shortcut Customization

**Priority**: SHOULD
**Description**: Users SHOULD be able to remap global shortcuts through the configuration UI without editing raw config files.
**Acceptance Criteria**:
- [ ] Shortcut config persisted to app settings file
- [ ] Conflict detection prevents binding the same key to two actions
- [ ] Reset-to-defaults action restores original shortcut map
**Traces to**: E5.1
**Status**: Planned

---

## FR-CONF-001: App Settings Persistence

**Priority**: SHALL
**Description**: Application settings SHALL be persisted to a platform-appropriate config file and loaded on startup.
**Acceptance Criteria**:
- [ ] Config file location follows OS conventions (XDG on Linux, AppData on Windows, ~/Library on macOS)
- [ ] Missing config triggers first-run defaults, not an error
- [ ] Schema versioning allows forward-compatible migrations
**Traces to**: E5.1
**Status**: Partial

---

## FR-CONF-002: Feature Flag Runtime Evaluation

**Priority**: SHALL
**Description**: Feature flags SHALL be evaluated at runtime against the config module and gate experimental UI surfaces.
**Acceptance Criteria**:
- [ ] Flags read from config on startup; no restart required for file-based changes
- [ ] Disabled flags hide associated UI elements entirely
- [ ] Flag state exposed in debug panel for inspection
**Traces to**: E5.1
**Status**: Planned

---

## FR-CONF-003: Provider Configuration UI

**Priority**: SHALL
**Description**: The settings panel SHALL expose per-provider configuration including API keys, model selection, and request limits.
**Acceptance Criteria**:
- [ ] Each registered provider has a settings section
- [ ] API keys stored via the secrets module, not plaintext config
- [ ] Save action validates the provider connection before persisting
**Traces to**: E3.1, E4.2
**Status**: Planned

---

## FR-CONF-004: Secrets Module Encryption

**Priority**: SHALL
**Description**: The secrets module SHALL encrypt stored credentials at rest using a platform keychain or AES-256 fallback.
**Acceptance Criteria**:
- [ ] Platform keychain used when available (macOS Keychain, libsecret, Windows DPAPI)
- [ ] AES-256-GCM fallback with key derived from machine ID when keychain unavailable
- [ ] Secrets never written to disk in plaintext
**Traces to**: E4.2
**Status**: Planned

---

## FR-PERF-001: Biome Lint Gate

**Priority**: SHALL
**Description**: All TypeScript source files SHALL pass Biome lint with zero errors before merge to main.
**Acceptance Criteria**:
- [ ] `biome check` exits 0 on the full source tree
- [ ] No inline suppression comments without documented justification
- [ ] Lint step runs in CI on every pull request
**Traces to**: E5.2
**Status**: Partial

---

## FR-PERF-002: Vitest Unit Test Coverage

**Priority**: SHALL
**Description**: The test suite SHALL maintain >= 80% line coverage across all non-UI modules as measured by Vitest.
**Acceptance Criteria**:
- [ ] `vitest --coverage` reports >= 80% lines on non-component code
- [ ] Coverage report artifact published on every CI run
- [ ] Regressions below threshold block merge
**Traces to**: E5.2
**Status**: Planned

---

## FR-PERF-003: Local Bus Latency

**Priority**: SHALL
**Description**: The local bus SHALL deliver command-to-response round-trips in under 10 ms on loopback for workloads with fewer than 100 concurrent messages.
**Acceptance Criteria**:
- [ ] P99 round-trip < 10 ms measured via integration test harness
- [ ] Correlation ID tracking confirms no message loss under load
- [ ] Performance regression test blocks merge if P99 exceeds threshold
**Traces to**: E1.1
**Status**: Planned

---

## FR-PERF-004: VitePress Documentation Build

**Priority**: SHOULD
**Description**: The docs site SHALL build successfully via VitePress on every main branch commit and be deployable as a static artifact.
**Acceptance Criteria**:
- [ ] `pnpm docs:build` exits 0 with no broken links
- [ ] Build artifact committed or uploaded to release storage
- [ ] Broken internal link check runs as part of docs build
**Traces to**: E5.2
**Status**: Planned
