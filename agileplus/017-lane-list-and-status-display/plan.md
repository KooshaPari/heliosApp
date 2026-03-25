# Implementation Plan: Lane Manager Panel

**Branch**: `017-lane-list-and-status-display` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/017-lane-list-and-status-display/spec.md`

## Summary

Deliver a left-rail lane manager panel displaying all lanes in the active workspace with color-coded health badges, CRUD actions (create, attach, detach, cleanup), and real-time status updates driven by internal bus events. The panel integrates with orphan detection (spec 015) to flag orphaned lanes and supports full keyboard navigation.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Left-rail panel listing all lanes in the active workspace.
  - Status badges: idle (gray), running (green), blocked (yellow), error (red), shared (blue), busy (provisioning/cleaning), closed.
  - Lane actions: create, attach, detach, cleanup with confirmation dialogs.
  - Real-time badge updates via bus event subscription.
  - Orphan-flagged lane indicators (spec 015 integration).
  - Keyboard navigation (arrow keys, Enter to attach).
  - Scrollable list with sticky workspace grouping headers.
- **Slice-2 (deferred)**:
  - Lane search and filtering.
  - Drag-and-drop lane reordering.
  - Lane grouping by custom tags or labels.

## Technical Context

**Language/Version**: TypeScript (Bun runtime + ElectroBun UI)
**Primary Dependencies**: Lane lifecycle (spec 008), session lifecycle (spec 009), orphan detection (spec 015), internal event bus, workspace identity (spec 005)
**Storage**: No dedicated persistence; lane state sourced from runtime registry and bus events
**Testing**: Vitest for logic, Playwright for UI interaction and real-time update verification
**Target Platform**: Local device-first desktop (ElectroBun shell)
**Performance Goals**: <300ms initial paint for 50 lanes, <1s badge update from event p95
**Constraints**: Must not block main UI thread; all updates via async event handling

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun + ElectroBun.
- **Testing posture**: PASS. Vitest + Playwright for panel UI coverage.
- **Coverage + traceability**: PASS. FR/NFR mapped to tests; >=85% coverage baseline.
- **Performance constraints**: PASS. Render and update latency SLOs defined.
- **Architecture discipline**: PASS. Panel is a pure UI consumer of bus events; no direct runtime mutation.

## Project Structure

### Documentation (this feature)

```
kitty-specs/017-lane-list-and-status-display/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/desktop/src/panels/
├── lane_panel.ts              # Left-rail panel container with scroll and grouping
├── lane_list_item.ts          # Individual lane entry with badge and actions
├── status_badge.ts            # Color-coded status badge component
├── lane_actions.ts            # Create, attach, detach, cleanup action handlers
├── confirmation_dialog.ts     # Cleanup confirmation dialog
├── lane_event_handler.ts      # Bus event subscription for real-time updates
└── keyboard_nav.ts            # Arrow key and Enter navigation logic
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Full lane state machine badge mapping | Spec requires visible indicators for all states including provisioning, cleaning, closed | Subset of states would leave operators blind to transitional lane states |
| Orphan integration | Orphan-flagged lanes need distinct UI treatment per spec | Ignoring orphan status in the panel would hide critical resource leak information |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on event-driven update paths.
- Enforce requirement traceability: every FR-017-* and NFR-017-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- Playwright tests must verify real-time badge updates within 1s of emitted events.
- Render benchmarks must verify <300ms initial paint with 50 lanes.
- No cleanup action may execute in any test without a simulated user confirmation step.
