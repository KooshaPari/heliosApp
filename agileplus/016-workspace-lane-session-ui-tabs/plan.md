# Implementation Plan: Multi-Tab Navigation UI

**Branch**: `016-workspace-lane-session-ui-tabs` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/016-workspace-lane-session-ui-tabs/spec.md`

## Summary

Deliver a multi-tab navigation system with five tab surfaces (terminal, agent, session, chat, project) bound to the active workspace/lane/session context. All tabs update atomically on context switch. Tab selection, ordering, and per-tab state persist across restarts. Full keyboard-driven navigation is supported with configurable shortcuts.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Five tab surfaces: terminal, agent, session, chat, project.
  - Context binding via the active (workspace_id, lane_id, session_id) triple.
  - Atomic context switch propagation to all visible tabs.
  - Configurable keyboard shortcuts for tab switching.
  - Stale-context indicator on tabs that fail to update.
  - Tab selection and ordering persistence across restarts.
- **Slice-2 (deferred)**:
  - User-defined custom tab surfaces (plugin tabs).
  - Split-view and multi-tab-per-surface layouts.
  - Tab grouping by workspace.

## Technical Context

**Language/Version**: TypeScript (Bun runtime + ElectroBun UI)
**Primary Dependencies**: Terminal registry (spec 014), lane/session lifecycle events (specs 008, 009), internal event bus (spec 001)
**Storage**: Persisted tab state (selection, order, scroll positions) via local file or embedded store
**Testing**: Vitest for logic, Playwright for UI interaction and keyboard navigation flows
**Target Platform**: Local device-first desktop (ElectroBun shell)
**Performance Goals**: <200ms tab switch p95, <500ms context propagation p95, <100ms input latency during loads
**Constraints**: No mouse-required workflows; all actions must be keyboard-accessible

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun + ElectroBun.
- **Testing posture**: PASS. Vitest + Playwright for full UI coverage.
- **Coverage + traceability**: PASS. FR/NFR mapped to tests; >=85% coverage baseline.
- **Performance constraints**: PASS. Tab switch and context propagation SLOs defined.
- **Architecture discipline**: PASS. Tabs consume context events via bus; no direct coupling to runtime internals.

## Project Structure

### Documentation (this feature)

```
kitty-specs/016-workspace-lane-session-ui-tabs/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/desktop/src/tabs/
├── tab_bar.ts                 # Tab bar component with ordering and selection
├── tab_surface.ts             # Base tab surface with context binding
├── terminal_tab.ts            # Terminal tab implementation
├── agent_tab.ts               # Agent tab implementation
├── session_tab.ts             # Session tab implementation
├── chat_tab.ts                # Chat tab implementation
├── project_tab.ts             # Project tab implementation
├── context_switch.ts          # Context switch propagation logic
├── keyboard_shortcuts.ts      # Configurable shortcut bindings
└── tab_persistence.ts         # Tab state persistence
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Atomic context propagation across five tabs | Mixed-context state across tabs leads to operator error per spec | Sequential per-tab updates would allow visible inconsistency during propagation |
| Stale-context indicator | Partial update failures must be surfaced rather than hidden | Silently showing stale data is worse than an explicit warning |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on context switch propagation.
- Enforce requirement traceability: every FR-016-* and NFR-016-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- Playwright tests must verify full keyboard-only workflows for all tab operations.
- Performance benchmarks must verify tab switch latency across 50+ sequential switches.
- Context consistency tests must verify zero mixed-context states across rapid lane switches.
