# Implementation Plan: Audit Logging and Session Replay

**Branch**: `024-audit-logging-and-session-replay` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/024-audit-logging-and-session-replay/spec.md`

## Summary

Implement an append-only audit event sink capturing every significant action with structured metadata and correlation IDs. Events are buffered in an in-memory ring buffer for hot queries and persisted to SQLite for durable 30+ day retention. A searchable ledger supports filtering by workspace, lane, session, actor, time range, and event type. Session replay reconstructs historical terminal sessions with time-scrubbing UI. Export produces redacted JSON bundles. Retention policies auto-purge expired events with deletion audit proofs.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - AuditEvent structured schema with actor, action, target, result, timestamps, and correlation IDs.
  - Append-only AuditSink with in-memory ring buffer and SQLite persistence.
  - Searchable AuditLedger with filtering by all key dimensions.
  - Session state snapshots at configurable intervals (default 30s).
  - Session replay UI with time-scrub, play/pause, and speed controls.
  - Configurable retention TTL with automated purge and deletion audit proof.
  - JSON export with redaction hooks (actual redaction rules from spec 028).
- **Slice-2 (deferred)**:
  - Legal hold exception implementation (UI and enforcement).
  - Cross-workspace audit federation.
  - Real-time alerting on audit event patterns.
  - Advanced replay features (annotation, sharing, diff between sessions).

## Technical Context

**Language/Version**: TypeScript 7, Bun >= 1.2
**Primary Dependencies**: SQLite (bun:sqlite), local bus (spec 002), correlation IDs (spec 005), redaction (spec 028)
**Storage**: In-memory ring buffer (hot) + SQLite (durable); target < 500 MB for 30 days at 100k events/day
**Testing**: Vitest for sink/ledger logic, chaos tests for crash durability, soak tests for completeness
**Target Platform**: Local device-first runtime (`apps/runtime`)
**Performance Goals**: Write < 5ms (p95), search < 500ms (p95) for 1M events, replay scrub < 200ms (p95)
**Constraints**: Writes must never block command execution; ring buffer overflow spills to SQLite, never drops events

## Constitution Check

- **Auditability**: PASS. Complete forensic trail of every agent action with correlation chains.
- **Retention compliance**: PASS. 30+ day durable retention with deletion proofs.
- **Local-first**: PASS. All data stored on-device in SQLite; no cloud dependency.
- **Testing posture**: PASS. Chaos tests for zero event loss; soak tests for completeness.
- **Performance discipline**: PASS. Async writes with bounded backpressure; never blocks hot path.

## Project Structure

### Documentation (this feature)

```
kitty-specs/024-audit-logging-and-session-replay/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/audit/
├── event.ts               # AuditEvent schema and types
├── sink.ts                # Append-only AuditSink (ring buffer + SQLite)
├── ledger.ts              # Searchable AuditLedger with filters
├── retention.ts           # TTL enforcement, purge, deletion proofs
├── snapshot.ts            # Session state snapshot capture
└── types.ts               # Shared audit types
apps/desktop/src/
└── panels/
    ├── audit-ledger.ts    # Searchable ledger UI
    └── session-replay.ts  # Replay UI with time-scrub controls
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dual-layer storage (ring buffer + SQLite) | Hot queries need sub-ms reads; durable retention needs 30+ days | SQLite-only adds latency to hot path; ring-buffer-only loses durability |
| Deletion audit proofs (hash chain) | Constitution requires provable purge integrity for compliance | Simple DELETE without proof leaves retention compliance unverifiable |

## Quality Gate Enforcement

- Zero audit events lost under simulated crash in 100% of chaos test runs.
- Correlation ID search returns complete event chain for 99.9% of traced operations.
- Session replay visual diff accuracy >= 95% across test sessions.
- Write latency < 5ms (p95) benchmarked in CI to ensure no hot-path blocking.
- Retention purge deletes only expired, non-held events with valid deletion proof.
- Export bundles pass redaction validation with zero leaked sensitive values.
- No suppression directives in audit module code.
