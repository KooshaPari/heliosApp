# heliosApp — Implementation Plan

**Project**: heliosApp (TypeScript Runtime Application)
**Version**: 1.0
**Status**: Active Specification
**Last Updated**: 2026-03-25

---

## Overview

heliosApp is a desktop runtime application for orchestrating parallel agent sessions, managing workspace/lane/session lifecycles, and providing a visual terminal interface. This plan structures implementation into four phases: Foundation (local bus protocol, workspace/session management), Desktop Shell (Tauri UI), Provider System (extensibility), and Observability/Security (audit, secrets).

---

## Phase 1: Foundation — Runtime Orchestration

Establish local bus protocol, workspace, lane, and session lifecycle management.

| Task ID | Description | Depends On | Status |
|---------|-------------|------------|--------|
| P1.1 | LocalBusEnvelope protocol (command, event, response types) | — | Done |
| P1.2 | Correlation tracking via correlation_id (UUID, lifecycle ordering) | P1.1 | Done |
| P1.3 | State machine enforcement (lifecycle transitions: idle → running → done) | P1.1 | Done |
| P1.4 | Workspace CRUD (create, read, update, list, delete) | P1.1, P1.3 | Done |
| P1.5 | Workspace persistence (store state, config, metadata to disk) | P1.4 | Done |
| P1.6 | Lane orchestration (PAR lanes for parallel execution) | P1.4 | Done |
| P1.7 | Lane-to-session binding (map lanes to active sessions) | P1.6 | Done |
| P1.8 | Session attach/detach with state machine (IDLE → ATTACHED → DETACHED) | P1.3, P1.7 | Done |
| P1.9 | PTY lifecycle manager for terminal processes (spawn, exec, terminate) | P1.8 | Done |
| P1.10 | Zellij mux adapter (integration with Zellij multiplexer if available) | P1.9 | Done |
| P1.11 | LocalBus router (dispatch commands/events to workspace/lane/session handlers) | P1.1, P1.4, P1.6, P1.8 | Done |
| P1.12 | Integration tests for local bus protocol and state transitions | P1.11 | Planned |

---

## Phase 2: Desktop Application — Tauri Shell

Implement native desktop app with visual terminal interface.

| Task ID | Description | Depends On | Status |
|---------|-------------|------------|--------|
| P2.1 | Tauri project setup (scaffolding, dependencies, config) | — | In Progress |
| P2.2 | TypeScript renderer (React/Vue component framework selection) | P2.1 | In Progress |
| P2.3 | Window management (main window, terminal pane layout) | P2.1 | In Progress |
| P2.4 | Terminal rendering UI component (render PTY output as HTML) | P2.2 | In Progress |
| P2.5 | Terminal input handling (keyboard, mouse, paste events) | P2.4 | In Progress |
| P2.6 | Workspace/Lane/Session UI (sidebar, workspace tree, lane list) | P2.2, P1.4, P1.6, P1.8 | In Progress |
| P2.7 | Runtime bus integration in Tauri (expose IPC for bus commands) | P2.3, P1.11 | In Progress |
| P2.8 | Session control buttons (attach/detach, clear, restart) | P2.6, P2.7 | Planned |
| P2.9 | Status indicators (workspace state, lane status, session health) | P2.6, P2.8 | Planned |
| P2.10 | Light/dark theme support | P2.2 | Planned |
| P2.11 | Responsive layout (resizable panes, fullscreen mode) | P2.4, P2.5 | Planned |
| P2.12 | E2E tests (Tauri app automation via WebDriver or custom harness) | P2.11 | Planned |

---

## Phase 3: Provider & Extension System

Implement pluggable provider adapters and extensibility.

| Task ID | Description | Depends On | Status |
|---------|-------------|------------|--------|
| P3.1 | Provider adapter interface (lifecycle hooks: init, exec, cleanup) | — | Planned |
| P3.2 | Provider registry (discovery, loading, management) | P3.1 | Planned |
| P3.3 | Configuration per-provider (env vars, config files, CLI flags) | P3.2 | Planned |
| P3.4 | Built-in provider: LocalShell (bash/zsh/sh execution) | P3.1, P3.2, P3.3 | Planned |
| P3.5 | Built-in provider: SSHAdapter (remote execution via SSH) | P3.1, P3.2, P3.3 | Planned |
| P3.6 | Provider error handling and retry logic | P3.3 | Planned |
| P3.7 | Provider health checks (ping, readiness) | P3.3 | Planned |
| P3.8 | Provider logging and observability | P3.3 | Planned |
| P3.9 | Extension points (hooks for custom providers, middleware) | P3.2 | Planned |
| P3.10 | Tauri provider bridge (expose provider interface to renderer) | P3.2, P2.7 | Planned |
| P3.11 | Integration tests (multi-provider scenarios) | P3.10 | Planned |

---

## Phase 4: Observability, Security & Quality

Audit logging, secrets management, config, and CI/CD.

| Task ID | Description | Depends On | Status |
|---------|-------------|------------|--------|
| P4.1 | Audit logging infrastructure (capture all bus events) | P1.1, P1.11 | Planned |
| P4.2 | Audit log storage (file or database backend) | P4.1 | Planned |
| P4.3 | Session replay from audit trail (reconstruct execution) | P4.2 | Planned |
| P4.4 | Secrets module (encrypted storage, key derivation) | — | Planned |
| P4.5 | Secret injection into terminal environments (env vars, files) | P4.4, P1.9 | Planned |
| P4.6 | Secret redaction in logs and UI (never display plaintext) | P4.1, P4.4 | Planned |
| P4.7 | App settings module (config loading, defaults) | — | Planned |
| P4.8 | Feature flags (runtime evaluation, toggle on/off) | P4.7 | Planned |
| P4.9 | Renderer engine settings (terminal emulator choice, colors, font) | P4.7, P2.4 | Planned |
| P4.10 | Biome linting (TypeScript, CSS, JSON) | — | Done |
| P4.11 | Vitest unit and integration tests (>80% coverage) | — | Planned |
| P4.12 | Policy gate (enforce PR policies: no merge commits, naming conventions) | — | Done |
| P4.13 | Stage gates (lint, test, build all pass) | P4.10, P4.11 | Done |
| P4.14 | Required check guards (CI/CD pipeline, security scanning) | P4.12, P4.13 | Done |
| P4.15 | VitePress documentation site (auto-deploy on main) | — | Done |
| P4.16 | Security scanning (gitleaks, SAST, dependency audit) | — | Done |
| P4.17 | CI/CD workflows (.github/workflows: build, test, deploy) | P4.10, P4.11, P4.14 | Done |

---

## Dependency Graph

```
P1.1 (LocalBusEnvelope) → P1.2 (correlation)
                       → P1.3 (state machine)
                       → P1.11 (router)
                       → P4.1 (audit logging)

P1.3 (state machine) → P1.4 (workspace CRUD)
                    → P1.8 (session lifecycle)

P1.4 (workspace) → P1.5 (persistence)
               → P1.6 (lane orchestration)
               → P2.6 (workspace UI)

P1.6 (lanes) → P1.7 (lane-session binding) → P1.8 (session attach/detach)

P1.8 (session) → P1.9 (PTY manager)
              → P2.6 (UI)
              → P4.5 (secret injection)

P1.9 (PTY) → P1.10 (Zellij adapter)
          → P2.4 (terminal rendering)

P1.11 (router) → P1.12 (integration tests)
              → P2.7 (Tauri IPC)

P2.1 (Tauri setup) → P2.2 (TypeScript renderer)
                  → P2.3 (window management)
                  → P3.10 (provider bridge)

P2.2 (renderer) → P2.4 (terminal UI)
               → P2.6 (workspace UI)
               → P4.7, P4.8, P4.9 (config, settings)

P2.3 (windows) → P2.4 (terminal) → P2.5 (input) → P2.11 (responsive)

P2.6 (UI) → P2.8 (session controls)
         → P2.9 (status indicators)

P2.7 (Tauri IPC) → P2.8 (controls)
               → P3.10 (provider bridge)

P3.1 (provider interface) → P3.2 (registry)
                        → P3.4, P3.5 (built-in providers)

P3.2 (registry) → P3.3 (config)
              → P3.9 (extension points)
              → P3.10 (Tauri bridge)

P3.3 (config) → P3.6 (error handling)
             → P3.7 (health checks)
             → P3.8 (logging)

P3.10 (provider bridge) → P3.11 (tests)

P4.1 (audit) → P4.2 (storage)
            → P4.3 (session replay)
            → P4.6 (redaction)

P4.4 (secrets) → P4.5 (injection)
              → P4.6 (redaction)

P4.7 (settings) → P4.8 (feature flags)
              → P4.9 (renderer settings)

P4.10 (Biome) → P4.12 (policy gate)
             → P4.16 (security scanning)

P4.11 (Vitest) → P4.13 (stage gates)

P4.12, P4.11 → P4.13 (stage gates) → P4.14 (required checks)

P4.14 (required checks) → P4.17 (CI/CD workflows)

P4.15 (VitePress) → P4.17 (CI/CD) via docs build
```

---

## Critical Path (Longest Dependency Chain)

P1.1 → P1.3 → P1.4 → P1.6 → P1.7 → P1.8 → P1.9 → P2.4 (terminal rendering)

Alternative (CI/CD): P4.10 (Biome) → P4.12 (policy gate) → P4.14 (required checks) → P4.17 (CI/CD)

---

## Implementation Notes

### Order of Execution (Recommended)
1. **P1** (Phase 1, DONE): Foundation tasks all complete.
   - P1.1–P1.3 establish protocols (done).
   - P1.4–P1.8 manage workspace/session (done).
   - P1.9–P1.11 follow (done).
   - P1.12 pending (integration tests).

2. **P2** (Phase 2, IN PROGRESS): Tauri desktop shell.
   - P2.1–P2.5 terminal UI (in progress).
   - P2.6–P2.7 integration (in progress).
   - P2.8–P2.12 follow (planned).

3. **P3** (Phase 3, PLANNED): Providers after P2.7.
   - P3.1–P3.3 provider interface (planned).
   - P3.4–P3.5 built-in providers (planned).
   - P3.10–P3.11 bridge and tests (planned).

4. **P4** (Phase 4, PARTIAL): Quality gates mostly done; observability pending.
   - P4.1–P4.6 audit/secrets (planned).
   - P4.7–P4.9 config/settings (planned).
   - P4.10–P4.17 CI/CD (done).

### Architecture Patterns
- **LocalBusEnvelope**: Unified protocol for all inter-component communication.
- **State Machine**: Enforced lifecycle transitions prevent invalid state combinations.
- **Provider Adapter Pattern**: Pluggable providers (LocalShell, SSH, future Cloud).
- **Correlation Tracking**: Every event carries correlation_id for audit trail.

### Testing Strategy
- **Unit**: Test state machine transitions, provider interfaces, config loading.
- **Integration**: Multi-component workflows (workspace → lane → session → command).
- **E2E**: Full Tauri app (launch desktop → create workspace → terminal interaction).
- **Audit/Replay**: Verify session replay accurately reconstructs from audit logs.

### Quality Gates
- **Biome Lint**: 0 errors (done).
- **Vitest Coverage**: >= 80% (planned).
- **Policy Gate**: No merge commits, naming conventions (done).
- **CI/CD**: All required checks pass (done).

### Security Model
- **Secrets**: Encrypted at-rest (PBKDF2 or similar), never logged or displayed.
- **Audit Trail**: Immutable event log; redact secrets before storage.
- **Session Replay**: Exclude secret values; substitute [REDACTED].
- **Code Scanning**: gitleaks pre-commit, SAST on every PR (done).

### Cross-Project Reuse
- **phenotype-config-ts**: Config management for app settings.
- **phenotype-logger**: Structured logging for audit trail.
- **phenotype-auth-ts**: Future multi-auth provider support.
- **phenotype-shared**: Common types (ItemType, StatusEnum, etc.).

---

## Success Criteria

| Phase | Criteria |
|-------|----------|
| P1 | LocalBus dispatches 100+ events without errors; state machine enforces valid transitions |
| P2 | Tauri app launches, renders terminal output, responds to input |
| P3 | Providers can be loaded and executed; custom provider example works |
| P4 | Audit trail captures all events; secrets never appear in logs; CI/CD gates pass |

---

## Deliverables

| Phase | Artifact |
|-------|----------|
| P1 | `src/runtime/bus.ts`, `src/runtime/workspace.ts`, integration test suite |
| P2 | Tauri app (release binary), terminal UI component, E2E test suite |
| P3 | Provider registry, LocalShell + SSH adapters, provider SDK docs |
| P4 | Audit log viewer, secrets CLI, VitePress docs site, CI/CD workflows |

---

**Owner**: Engineering Team
**Status**: ACTIVE
**Last Review**: 2026-03-25
