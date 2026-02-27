# Implementation Plan: Renderer Engine Settings Control

**Branch**: `018-renderer-engine-settings-control` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/018-renderer-engine-settings-control/spec.md`

## Summary

Deliver a settings panel section for renderer engine selection between ghostty and rio, displaying capability details (version, hot-swap support, features), triggering renderer switch transactions (spec 013) with confirmation, showing real-time switch progress indicators, and providing a hot-swap preference toggle. Preferences persist across sessions with ghostty as the default.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Settings panel renderer section with ghostty and rio options.
  - Capability display per renderer (version, hot-swap support, feature set).
  - Confirmation dialog before triggering switch.
  - Real-time status indicators during switch transactions (phase, progress, outcome).
  - Hot-swap preference toggle (prefer hot-swap vs. always restart-with-restore).
  - Persisted renderer preference and toggle across restarts.
  - Settings lock during active switch transactions.
- **Slice-2 (deferred)**:
  - Per-lane renderer override settings.
  - Renderer performance comparison dashboard.
  - Third-party renderer plugin support.

## Technical Context

**Language/Version**: TypeScript (Bun runtime + ElectroBun UI)
**Primary Dependencies**: Renderer switch transaction (spec 013), renderer capabilities (spec 010), feature flags (spec 004), internal event bus
**Storage**: Persisted preferences via local settings store (file-backed)
**Testing**: Vitest for logic, Playwright for UI interactions and switch flow verification
**Target Platform**: Local device-first desktop (ElectroBun shell)
**Performance Goals**: <200ms settings render, <500ms status indicator update from phase change, <100ms preference load on startup
**Constraints**: Settings must be locked during active transactions; ghostty is the default renderer

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun + ElectroBun.
- **Testing posture**: PASS. Vitest + Playwright for settings UI coverage.
- **Coverage + traceability**: PASS. FR/NFR mapped to tests; >=85% coverage baseline.
- **Performance constraints**: PASS. Render and update latency SLOs defined.
- **Architecture discipline**: PASS. Settings UI delegates to spec 013 transaction; no direct renderer manipulation.

## Project Structure

### Documentation (this feature)

```
kitty-specs/018-renderer-engine-settings-control/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/desktop/src/settings/
├── renderer_settings.ts       # Renderer section container
├── renderer_option.ts         # Individual renderer entry with capabilities
├── capability_display.ts      # Capability detail expansion panel
├── switch_confirmation.ts     # Confirmation dialog before switch
├── switch_status.ts           # Real-time transaction status indicator
├── hotswap_toggle.ts          # Hot-swap preference toggle
├── renderer_preferences.ts    # Persistence for renderer selection and toggle
└── settings_lock.ts           # UI lock during active transactions
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Settings lock during transactions | Concurrent settings changes during a switch could cause inconsistent state | Allowing edits during switch would require conflict resolution that adds more complexity |
| Real-time status indicators | Multi-second switch transactions need user feedback per spec | No feedback during a 3-8s operation would cause user anxiety and premature interruption |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on preference persistence and transaction integration.
- Enforce requirement traceability: every FR-018-* and NFR-018-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- Playwright tests must verify settings lock during simulated switch transactions.
- Persistence tests must verify preference survival across 100% of restart cycles.
- Status indicator tests must verify phase updates within 500ms of transaction events.
