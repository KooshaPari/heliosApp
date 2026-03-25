# Work Packages: Audit Logging and Session Replay

**Inputs**: Design documents from `/kitty-specs/024-audit-logging-and-session-replay/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because audit integrity is a constitution requirement and requires chaos testing for zero-loss guarantees.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/024-audit-logging-and-session-replay/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/runtime/`, `apps/desktop/`, and `kitty-specs/`.

---

## Work Package WP01: Audit Event Schema and Append-Only Sink (Priority: P0)

**Phase**: Phase 1 - Audit Foundation
**Goal**: Define the structured audit event schema with all required fields and implement the append-only audit sink with async writes that never block the command execution hot path.
**Independent Test**: Write 10,000 audit events, verify all are persisted, verify write latency < 5ms (p95), verify no events lost under simulated backpressure.
**Prompt**: `/kitty-specs/024-audit-logging-and-session-replay/tasks/WP01-audit-event-schema-and-sink.md`
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [ ] T001 Define `AuditEvent` schema: actor, action, target, result, timestamp, workspace ID, lane ID, session ID, correlation ID, event type, and metadata
- [ ] T002 Implement append-only `AuditSink` interface with async write, bounded backpressure, and guaranteed delivery (buffer on failure, never drop)
- [ ] T003 Subscribe `AuditSink` to local bus events for automatic capture of lifecycle events
- [ ] T004 [P] Add unit tests: event schema validation, sink write latency benchmark (< 5ms p95), backpressure behavior under simulated slow writes

### Implementation Notes
- Writes must be async and never block the command execution hot path.
- Events must never be dropped: if persistence fails, buffer in memory and retry.
- The sink is the foundation for all downstream audit features (ledger, replay, export).

### Parallel Opportunities
- T004 can proceed after T001-T003 interfaces are stable.

### Dependencies
- None (self-contained audit foundation).

### Risks & Mitigations
- Risk: High event throughput overwhelms the async write buffer.
- Mitigation: Bounded backpressure with overflow metrics; spill to SQLite when buffer is full.

---

## Work Package WP02: Storage Layer — Ring Buffer and SQLite Persistence (Priority: P0)

**Goal**: Implement the dual-layer storage: in-memory ring buffer for hot queries on recent events, and SQLite persistence for durable 30+ day retention. Ring buffer overflow spills to SQLite, never drops events.
**Independent Test**: Fill the ring buffer beyond capacity, verify overflow events are persisted to SQLite. Simulate crash, restart, verify all persisted events are recoverable.
**Prompt**: `/kitty-specs/024-audit-logging-and-session-replay/tasks/WP02-ring-buffer-and-sqlite-storage.md`
**Estimated Prompt Size**: ~340 lines

### Included Subtasks
- [ ] T005 Implement in-memory ring buffer with configurable capacity for hot event access
- [ ] T006 Implement SQLite persistence layer using `bun:sqlite` with schema matching AuditEvent, WAL mode for concurrent access
- [ ] T007 Implement overflow strategy: ring buffer eviction spills events to SQLite, never drops
- [ ] T008 [P] Add chaos tests: simulated crash during write, verify zero event loss; fill ring buffer to overflow, verify SQLite persistence

### Implementation Notes
- Ring buffer provides sub-millisecond reads for recent events.
- SQLite provides durable retention for 30+ days at 100k events/day under 500 MB.
- WAL mode ensures reads do not block writes.

### Parallel Opportunities
- T008 can proceed after T005-T007 are functional.

### Dependencies
- Depends on WP01 (event schema and sink interface).

### Risks & Mitigations
- Risk: SQLite storage exceeds 500 MB at target event rates.
- Mitigation: Implement compaction; monitor storage size in health checks.

---

## Work Package WP03: Searchable Ledger and Filtering API (Priority: P1)

**Goal**: Implement the searchable audit ledger with filtering by workspace, lane, session, actor, time range, event type, and correlation ID. Support real-time updates via bus subscription.
**Independent Test**: Insert 10,000 events across multiple workspaces and sessions, query by various filters, verify results return within 500ms and match expected sets.
**Prompt**: `/kitty-specs/024-audit-logging-and-session-replay/tasks/WP03-searchable-ledger-and-filtering.md`
**Estimated Prompt Size**: ~330 lines

### Included Subtasks
- [ ] T009 Implement `AuditLedger` with multi-dimensional filtering: workspace, lane, session, actor, time range, event type, correlation ID
- [ ] T010 Implement correlation ID chain traversal: given a correlation ID, return all related events across lanes and sessions in chronological order
- [ ] T011 Implement real-time ledger updates: subscribe to bus events and push new matching events to active queries
- [ ] T012 Create ledger query API endpoints in the runtime API surface
- [ ] T013 [P] Add search performance tests: 500ms (p95) for 1 million event dataset; correlation chain traversal tests

### Implementation Notes
- Use SQLite indexed queries for the heavy lifting; ring buffer for recent event shortcut.
- Correlation chain traversal is critical for debugging and incident response.
- Real-time updates use bus subscription, not polling.

### Parallel Opportunities
- T013 can proceed after T009-T012 are functional.

### Dependencies
- Depends on WP02 (storage layer).

### Risks & Mitigations
- Risk: Complex multi-filter queries are slow on large datasets.
- Mitigation: Add SQLite indexes on all filterable columns; benchmark with target dataset size.

---

## Work Package WP04: Session Replay UI, Retention, Export, and Tests (Priority: P2)

**Goal**: Deliver session replay with time-scrubbing UI, configurable retention with automated purge and deletion proofs, JSON export with redaction hooks, and comprehensive tests for the entire audit system.
**Independent Test**: Replay a recorded session with time-scrub controls; verify retention purge deletes only expired events with valid deletion proofs; verify export produces redacted JSON bundles.
**Prompt**: `/kitty-specs/024-audit-logging-and-session-replay/tasks/WP04-session-replay-retention-export.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T014 Implement session state snapshot capture at configurable intervals (default 30s) with terminal buffer, cursor, and dimensions
- [ ] T015 Implement session replay engine: reconstruct terminal output from snapshots and events, support time-indexed random access
- [ ] T016 Implement session replay UI in `apps/desktop/src/panels/session-replay.ts` with play/pause, speed control, and time-scrub slider
- [ ] T017 Implement retention policy model: per-workspace TTL configuration, legal hold exception flag, and purge schedule
- [ ] T018 Implement automated retention purge: delete expired events, generate deletion audit proof (hash chain), preserve legal-hold events
- [ ] T019 Implement JSON export with redaction hooks: produce bundles with sensitive values redacted per spec 028 rules
- [ ] T020 [P] Add chaos tests: zero event loss under crash (soak test), retention purge correctness, export redaction validation (1000 randomized exports)
- [ ] T021 [P] Add replay tests: time-scrub to specific timestamps, verify terminal state rendered within 200ms, handle missing/corrupted snapshots gracefully

### Implementation Notes
- Replay must handle missing snapshots by degrading to event-only playback.
- Retention purge must produce a verifiable deletion proof (hash chain or equivalent).
- Export without redaction rules (spec 028) must be blocked; placeholder redaction hooks are acceptable.

### Parallel Opportunities
- T020 and T021 can proceed after T014-T019 are functional.

### Dependencies
- Depends on WP03.

### Risks & Mitigations
- Risk: Session replay fidelity depends on snapshot interval; 30s may miss rapid changes.
- Mitigation: Interpolate between snapshots using the event stream; document fidelity limitations.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03 → WP04.
- **Parallelization**: Within each WP, test subtasks can run after core implementations.
- **MVP Scope**: WP01 + WP02 provide durable audit infrastructure; WP03 adds querying; WP04 adds replay, retention, and export.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | AuditEvent schema definition | WP01 | P0 | No |
| T002 | Append-only AuditSink | WP01 | P0 | No |
| T003 | Bus subscription for auto-capture | WP01 | P0 | No |
| T004 | Event schema + sink tests | WP01 | P0 | Yes |
| T005 | In-memory ring buffer | WP02 | P0 | No |
| T006 | SQLite persistence layer | WP02 | P0 | No |
| T007 | Ring buffer overflow to SQLite | WP02 | P0 | No |
| T008 | Storage chaos tests | WP02 | P0 | Yes |
| T009 | AuditLedger multi-filter | WP03 | P1 | No |
| T010 | Correlation chain traversal | WP03 | P1 | No |
| T011 | Real-time ledger updates | WP03 | P1 | No |
| T012 | Ledger API endpoints | WP03 | P1 | No |
| T013 | Search performance tests | WP03 | P1 | Yes |
| T014 | Session state snapshots | WP04 | P2 | No |
| T015 | Session replay engine | WP04 | P2 | No |
| T016 | Session replay UI | WP04 | P2 | No |
| T017 | Retention policy model | WP04 | P2 | No |
| T018 | Automated purge + deletion proofs | WP04 | P2 | No |
| T019 | JSON export with redaction | WP04 | P2 | No |
| T020 | Chaos + retention + export tests | WP04 | P2 | Yes |
| T021 | Replay fidelity tests | WP04 | P2 | Yes |
