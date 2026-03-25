# Feature Specification: Local Bus v1 Protocol and Envelope

**Feature Branch**: `002-local-bus-v1-protocol-and-envelope`
**Created**: 2026-02-27
**Status**: Draft

## Overview

Internal command/response/event bus for heliosApp. This is the nervous system: every subsystem communicates through the local bus. Scope: envelope schema, correlation IDs, method and topic registries, deterministic event sequencing, validation, and error taxonomy. The bus is transport-agnostic at this layer — it defines the message contract, not the wire format.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Subsystem Command Dispatch (Priority: P0)

As a subsystem developer, I can send a typed command through the bus and receive a correlated response so that subsystems communicate without direct coupling.

**Why this priority**: Every other feature depends on reliable command dispatch.

**Independent Test**: Send a command from subsystem A, verify subsystem B receives it with correct envelope fields, and confirm the response carries the same correlation ID.

**Acceptance Scenarios**:

1. **Given** a registered method, **When** a subsystem sends a command envelope, **Then** the bus routes it to exactly one handler and returns a correlated response.
2. **Given** an unregistered method, **When** a command is dispatched, **Then** the bus returns a structured `METHOD_NOT_FOUND` error within the envelope.
3. **Given** a handler that throws, **When** the error propagates, **Then** the bus wraps it in the error taxonomy and returns it as a correlated error response.

---

### User Story 2 — Event Publish/Subscribe (Priority: P0)

As a subsystem developer, I can publish events to named topics and subscribe to them so that state changes propagate without polling.

**Why this priority**: Event-driven architecture eliminates polling and enables reactive UI updates.

**Acceptance Scenarios**:

1. **Given** a subscriber on topic T, **When** an event is published to T, **Then** the subscriber receives the event with monotonically increasing sequence number.
2. **Given** multiple subscribers on the same topic, **When** an event is published, **Then** all subscribers receive it in the same deterministic order.
3. **Given** no subscribers on a topic, **When** an event is published, **Then** the bus discards it silently without error.

---

### User Story 3 — Envelope Validation and Traceability (Priority: P1)

As an operator debugging a production issue, I can trace any operation end-to-end using correlation IDs embedded in every envelope.

**Why this priority**: Without traceability, debugging multi-subsystem interactions becomes intractable.

**Acceptance Scenarios**:

1. **Given** a command that triggers downstream events, **When** inspecting logs, **Then** all envelopes share the originating correlation_id.
2. **Given** a malformed envelope (missing required fields), **When** dispatched, **Then** the bus rejects it synchronously with a `VALIDATION_ERROR` before routing.

---

### Edge Cases

- Bus must handle re-entrant dispatches (handler sends a command during its own execution) without deadlock.
- Sequence numbers must remain monotonic even under concurrent publish from multiple subsystems.
- Envelope validation must reject oversized payloads (configurable limit, default 1 MB).
- Bus must remain operational if a single subscriber throws; other subscribers still receive the event.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bus MUST define an envelope schema containing: `id`, `correlation_id`, `method` (for commands) or `topic` (for events), `payload`, `timestamp`, `sequence`, and `error` (for responses).
- **FR-002**: The bus MUST generate globally unique `id` and `correlation_id` values per spec 005 ID standards.
- **FR-003**: The bus MUST maintain a method registry where subsystems register command handlers by method name.
- **FR-004**: The bus MUST maintain a topic registry where subsystems register event subscriptions by topic name.
- **FR-005**: The bus MUST assign monotonically increasing sequence numbers to events within each topic.
- **FR-006**: The bus MUST validate every envelope against the schema before routing; malformed envelopes are rejected with `VALIDATION_ERROR`.
- **FR-007**: The bus MUST define an error taxonomy: `VALIDATION_ERROR`, `METHOD_NOT_FOUND`, `HANDLER_ERROR`, `TIMEOUT`, `BACKPRESSURE`.
- **FR-008**: The bus MUST propagate correlation_id from originating command through all downstream events.
- **FR-009**: The bus MUST deliver events to all subscribers of a topic in deterministic order.
- **FR-010**: The bus MUST isolate subscriber failures: one subscriber throwing does not prevent delivery to others.

### Non-Functional Requirements

- **NFR-001**: Command dispatch latency (send to handler invocation) MUST be < 1ms (p95) for in-process routing.
- **NFR-002**: Event fan-out to 50 subscribers MUST complete in < 5ms (p95).
- **NFR-003**: Envelope validation MUST complete in < 0.1ms (p95).
- **NFR-004**: Bus MUST handle 10,000 messages/second sustained without message loss or ordering violation.
- **NFR-005**: Memory overhead per registered method/topic MUST be < 1 KB.

### Dependencies

- **Spec 005** (ID Standards): Envelope IDs and correlation IDs follow the unified ID schema.

## Key Entities

- **Envelope**: Structured message unit carrying command, response, or event data with metadata fields.
- **Method**: Named command endpoint in the method registry, bound to exactly one handler.
- **Topic**: Named event channel in the topic registry, bound to zero or more subscribers.
- **Correlation ID**: Unique identifier linking a command to its response and all downstream events.
- **Sequence Number**: Monotonically increasing per-topic counter ensuring deterministic event ordering.
- **Error Taxonomy**: Enumerated error categories with structured codes and human-readable messages.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of dispatched commands carry valid correlation_id from origin through response.
- **SC-002**: Event ordering tests confirm monotonic sequence numbers across 10,000 concurrent publishes with zero inversions.
- **SC-003**: Malformed envelope injection tests produce `VALIDATION_ERROR` in 100% of cases with zero routing to handlers.
- **SC-004**: Subscriber isolation tests confirm one throwing subscriber does not affect delivery to others in 100% of cases.
- **SC-005**: Latency SLOs (< 1ms dispatch, < 5ms fan-out) met in 95% of measurements under sustained 10k msg/s load.

## Assumptions

- Bus is in-process for MVP; IPC or networked transport is a future extension.
- The bus is synchronous-first for commands (request/response) and async for events (pub/sub).
- Formal method and topic registries will be maintained as JSON assets in `specs/protocol/v1/`.
- Envelope schema versioning follows semver; v1 is the initial contract.
