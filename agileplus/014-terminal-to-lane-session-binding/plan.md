# Implementation Plan: Terminal Registry and Context Binding

**Branch**: `014-terminal-to-lane-session-binding` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/014-terminal-to-lane-session-binding/spec.md`

## Summary

Deliver a terminal registry that authoritatively maps every terminal_id to a (workspace_id, lane_id, session_id) binding triple. The registry enforces consistency validation before every terminal operation, durably persists binding state across restarts, and emits lifecycle events for all binding changes. Lookups by any key complete in under 2ms.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - In-memory registry with durable persistence (file-backed or SQLite).
  - Binding validation middleware for terminal operations.
  - Multi-key lookup (by terminal, lane, session, or workspace).
  - Lifecycle event emission (bound, rebound, unbound, validation-failed).
  - Integration with lane/session lifecycle events for automatic binding invalidation.
- **Slice-2 (deferred)**:
  - Cross-device registry synchronization.
  - Registry compaction and archival for long-lived workspaces.
  - Binding history and audit trail.

## Technical Context

**Language/Version**: TypeScript (Bun runtime)
**Primary Dependencies**: Internal event bus (spec 001), workspace identity (spec 003), lane lifecycle (spec 008), session lifecycle (spec 009)
**Storage**: Durable persistence (file-backed store or embedded SQLite) with in-memory index for fast lookups
**Testing**: Vitest for unit/integration, property-based tests for consistency invariants
**Target Platform**: Local device-first desktop runtime
**Performance Goals**: <5ms validation overhead p95, <2ms lookup p95, 1000+ concurrent bindings
**Constraints**: Every terminal must have a valid binding; no unbound terminals allowed during normal operation

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun implementation.
- **Testing posture**: PASS. Vitest with property-based consistency tests.
- **Coverage + traceability**: PASS. FR/NFR mapped to tests; >=85% coverage baseline.
- **Performance constraints**: PASS. Lookup and validation latency SLOs defined.
- **Architecture discipline**: PASS. Registry is a single authoritative source with clear query and mutation interfaces.

## Project Structure

### Documentation (this feature)

```
kitty-specs/014-terminal-to-lane-session-binding/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/registry/
├── terminal_registry.ts       # Core registry with CRUD and lookup
├── binding_triple.ts          # Binding type definitions and validation
├── binding_middleware.ts      # Pre-operation validation interceptor
├── persistence.ts             # Durable persistence adapter
└── binding_events.ts          # Lifecycle event emission
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Durable persistence for bindings | Must survive runtime restarts per FR-014-008 | In-memory only would lose all bindings on crash, requiring full re-discovery |
| Multi-key indexing | Lookups by any component of the triple required per FR-014-006 | Single-key index would force full scans for lane/session/workspace queries |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on validation middleware.
- Enforce requirement traceability: every FR-014-* and NFR-014-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- Property-based tests must verify: no duplicate terminal_ids, no unbound terminals after creation, binding consistency after lane/session lifecycle changes.
- Latency benchmarks must verify p95 targets under load (500+ bindings).
