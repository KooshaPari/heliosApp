# Feature Specification: Audit Logging and Session Replay

**Feature Branch**: `024-audit-logging-and-session-replay`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Append-only audit event sink that captures every significant action in heliosApp with structured metadata and correlation IDs. Events are buffered in memory for hot queries and persisted to SQLite for durable retention (30+ days per constitution). The system provides a searchable ledger filtered by workspace, lane, session, actor, time range, and event type. Session replay reconstructs historical terminal sessions with time-scrubbing UI. Export produces redacted JSON bundles suitable for compliance review.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automatic Audit Capture (Priority: P0)

As an operator, I want every agent action, policy decision, and system event recorded automatically so I have a complete forensic trail without manual effort.

**Why this priority**: Constitution requires full audit trail; this is the foundation for trust and compliance.

**Acceptance Scenarios**:

1. **Given** an agent executes a command via lane, **When** the command completes, **Then** an audit event is recorded with actor, action, target, result, timestamp, workspace ID, lane ID, and correlation ID.
2. **Given** a policy evaluation occurs (spec 023), **When** the decision is made, **Then** the evaluation result is captured as an audit event linked to the originating command.
3. **Given** audit storage is full or write fails, **When** a new event arrives, **Then** the system raises an alert and buffers events in memory rather than dropping them.

---

### User Story 2 — Search and Filter Audit Log (Priority: P0)

As an operator, I can search the audit ledger by workspace, lane, session, actor, time range, or event type to investigate what happened and when.

**Why this priority**: Constitution requires searchable logs; an unsearchable log has no operational value.

**Acceptance Scenarios**:

1. **Given** 10,000 audit events, **When** the operator filters by workspace and time range, **Then** matching results return within 500ms.
2. **Given** a correlation ID from an error, **When** the operator searches by that ID, **Then** all related events across lanes and sessions are returned in chronological order.
3. **Given** an active filter, **When** new matching events arrive, **Then** the ledger view updates in real time via bus subscription.

---

### User Story 3 — Session Replay (Priority: P1)

As an operator, I can replay a historical terminal session to understand exactly what an agent did, including terminal output, commands, and timing.

**Why this priority**: Post-incident review requires seeing what actually happened, not just event metadata.

**Acceptance Scenarios**:

1. **Given** a completed session with replay data, **When** the operator opens replay, **Then** terminal output is reconstructed and playable with time-scrubbing controls.
2. **Given** a replay in progress, **When** the operator scrubs to a specific timestamp, **Then** the terminal state at that moment is rendered within 200ms.
3. **Given** a session with state snapshots at 30-second intervals, **When** scrubbing between snapshots, **Then** intermediate states are interpolated from the event stream.

---

### User Story 4 — Export and Retention (Priority: P1)

As an operator, I can export session or workspace audit bundles and configure retention policies.

**Acceptance Scenarios**:

1. **Given** a workspace, **When** the operator exports its audit data, **Then** a JSON bundle is produced with redaction applied per spec 028 rules.
2. **Given** a 30-day retention policy, **When** events age past the TTL, **Then** they are purged automatically and a deletion audit proof is recorded.
3. **Given** a legal hold is placed on a workspace, **When** the TTL expires, **Then** events are retained despite the TTL and the hold is surfaced in the UI.

---

### Edge Cases

- Audit writes must never block the command execution hot path; writes are async with bounded backpressure.
- Ring buffer overflow must spill to SQLite, not drop events.
- Replay must handle sessions with corrupted or missing snapshots by degrading to event-only playback.
- Export must handle concurrent export requests without locking the audit store.
- Clock skew between subsystems must be tolerated; events are ordered by correlation ID chain, not wall clock alone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-024-001**: The system MUST capture audit events with structured schema: actor, action, target, result, timestamp, workspace ID, lane ID, session ID, and correlation ID.
- **FR-024-002**: The system MUST write events to an append-only log; no mutation or deletion of audit records except via retention purge.
- **FR-024-003**: The system MUST maintain an in-memory ring buffer for hot queries on recent events.
- **FR-024-004**: The system MUST persist events to SQLite for durable retention of at least 30 days.
- **FR-024-005**: The system MUST provide search/filter over the audit ledger by workspace, lane, session, actor, time range, event type, and correlation ID.
- **FR-024-006**: The system MUST capture terminal session state snapshots at configurable intervals for replay reconstruction.
- **FR-024-007**: The system MUST provide a session replay UI with time-scrubbing, play/pause, and speed controls.
- **FR-024-008**: The system MUST export audit data as JSON bundles with redaction applied per spec 028 rules.
- **FR-024-009**: The system MUST enforce configurable retention TTL with automated purge and deletion audit proof.
- **FR-024-010**: The system MUST support legal hold exceptions that override TTL-based purge.
- **FR-024-011**: The system MUST record a deletion audit proof (hash chain or equivalent) when purging expired events.

### Non-Functional Requirements

- **NFR-024-001**: Audit event write latency MUST be < 5ms (p95) to avoid blocking command execution.
- **NFR-024-002**: Ledger search MUST return results within 500ms (p95) for datasets up to 1 million events.
- **NFR-024-003**: Session replay scrub-to-render MUST complete within 200ms (p95).
- **NFR-024-004**: SQLite audit store MUST support at least 30 days of retention at 100,000 events/day without exceeding 500 MB.
- **NFR-024-005**: Zero audit events lost under simulated crash in 100% of chaos test runs.

### Dependencies

- **Spec 002** (Local Bus): Audit sink subscribes to bus events for automatic capture.
- **Spec 005** (IDs/Correlation): Correlation IDs link events across lanes and sessions.
- **Spec 028** (Redaction): Export applies redaction rules before producing bundles.

## Key Entities

- **AuditEvent**: Immutable structured record with actor, action, target, result, timestamp, context IDs (workspace, lane, session), and correlation ID.
- **AuditSink**: Append-only event receiver with in-memory ring buffer and SQLite persistence backend.
- **AuditLedger**: Searchable index over persisted events with filter and correlation query support.
- **SessionSnapshot**: Point-in-time capture of terminal state (buffer contents, cursor, dimensions) for replay interpolation.
- **ReplayStream**: Ordered sequence of events and snapshots for a session, supporting time-indexed random access.
- **RetentionPolicy**: Per-workspace TTL configuration with legal hold exception flag and purge schedule.

## Success Criteria *(mandatory)*

- **SC-024-001**: 100% of agent-mediated actions produce a corresponding audit event verified over a 24-hour soak test.
- **SC-024-002**: Correlation ID search returns the complete event chain for 99.9% of traced operations.
- **SC-024-003**: Session replay accurately reconstructs terminal output for 95% of test sessions as verified by visual diff.
- **SC-024-004**: Retention purge deletes only expired, non-held events and produces valid deletion proof in 100% of test runs.
- **SC-024-005**: Export bundles pass redaction validation with zero leaked sensitive values across 1000 randomized exports.

## Assumptions

- A single SQLite database per workspace is sufficient for audit storage at target scale.
- Session replay fidelity depends on snapshot interval; default 30 seconds is acceptable for post-incident review.
- Redaction rules (spec 028) are defined before export is implemented; export without redaction is blocked.
- Clock synchronization across subsystems is within 100ms; the system uses correlation chains for ordering, not wall clock.
