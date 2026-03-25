# Implementation Plan: App Settings and Feature Flags

**Branch**: `004-app-settings-and-feature-flags` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement the settings substrate: typed schema with defaults, validation, JSON persistence, hot-reload propagation via bus events, and a feature flag subsystem. First flag: `renderer_engine` (ghostty | rio). Settings are per-installation for MVP; workspace-level overrides are deferred.

## Scope Contract

- **In scope (this slice)**:
  - Typed settings schema with defaults, types, validation rules, and reload policy (hot/restart).
  - JSON file persistence in app data directory; restore on startup.
  - Schema validation on every write; reject invalid values.
  - Hot-reload: `settings.changed` bus events for hot-reloadable settings.
  - Restart-required indicator for non-hot settings.
  - Feature flag subsystem with typed query API.
  - `renderer_engine` flag: `ghostty` (default), `rio`.
  - Unknown key preservation for forward compatibility.
- **Deferred**:
  - Settings UI (owned by spec 001 / desktop shell).
  - Workspace-specific setting overrides.
  - Remote feature flag service.
  - SQLite backend (aligns with spec 003 durability phase).

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Bun, spec 002 (bus events for settings.changed)
**Storage**: JSON file in app data directory
**Testing**: Vitest for unit/integration, microbenchmarks for flag read latency
**Target Platform**: Local device-first desktop runtime
**Constraints**: Dockerless, zero-allocation flag reads (< 0.01ms p95), < 50ms write, < 500ms hot-reload propagation
**Performance Goals**: NFR-001 through NFR-004 per spec

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + Playwright.
- **Coverage + traceability**: PASS. >=85% baseline.
- **Performance/local-first**: PASS. Local JSON, zero network.
- **Dockerless**: PASS.
- **Device-first**: PASS. `renderer_engine` flag directly serves the dual-renderer local architecture.

## Project Structure

### Source Code

```
apps/runtime/src/config/
├── schema.ts           # Settings schema definition, defaults, validation rules, reload policy
├── store.ts            # JSON persistence, in-memory cache, file watch for external edits
├── settings.ts         # Read/write API, validation, change detection, bus event emission
├── flags.ts            # Feature flag subsystem, typed queries, zero-alloc read path
└── types.ts            # Setting, SettingValue, FeatureFlag, ReloadPolicy types
```

### Planning Artifacts

```
kitty-specs/004-app-settings-and-feature-flags/
├── spec.md
├── plan.md
└── tasks.md
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Unknown key preservation | Forward compat: newer config version keys must not be silently stripped by older runtime | Simple schema-only serialization destroys unrecognized keys on save |
| Zero-allocation flag read path | Feature flags are queried on terminal input hot path; any allocation adds latency jitter | Standard Map lookup allocates iterator objects in some engines |

## Quality Gate Enforcement

- Line coverage >= 85%; schema validation and flag read path target >= 95%.
- FR-to-test traceability: every FR-00x maps to at least one named test.
- Fail closed on lint, type-check, and test gate violations.
- Microbenchmark gate: flag read < 0.01ms p95 under load; write < 50ms p95.
- Hot-reload integration test: setting change reaches subscriber within 500ms.
- Edge case tests: deleted settings file, concurrent writes, unknown keys round-trip.
