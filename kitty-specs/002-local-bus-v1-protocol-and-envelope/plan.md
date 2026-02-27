# Implementation Plan: Local Bus v1 Protocol and Envelope

**Branch**: `002-local-bus-v1-protocol-and-envelope` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement the in-process command/response/event bus that forms heliosApp's nervous system. Delivers envelope schema with correlation IDs, method and topic registries, deterministic event sequencing, validation, and a structured error taxonomy. All subsystem communication routes through this bus.

## Scope Contract

- **In scope (this slice)**:
  - Envelope schema definition and runtime validation (id, correlation_id, method/topic, payload, timestamp, sequence, error).
  - Method registry: register handler by name, dispatch commands, return correlated responses.
  - Topic registry: subscribe/publish, monotonic sequence numbers, deterministic delivery order.
  - Error taxonomy: `VALIDATION_ERROR`, `METHOD_NOT_FOUND`, `HANDLER_ERROR`, `TIMEOUT`, `BACKPRESSURE`.
  - Correlation ID propagation from originating command through all downstream events.
  - Subscriber isolation (one throw does not block others).
  - JSON schema assets in `specs/protocol/v1/`.
- **Deferred**:
  - IPC or networked transport (bus is in-process only for MVP).
  - Persistent message replay or dead-letter queues.
  - Backpressure flow control beyond error classification.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Bun, spec 005 ID library for envelope IDs
**Storage**: None (purely in-memory message routing)
**Testing**: Vitest for unit/integration, Playwright for any E2E smoke paths
**Target Platform**: Local device-first desktop runtime
**Constraints**: Dockerless, in-process only, < 1ms p95 dispatch latency, re-entrant safe, 10k msg/s sustained throughput
**Performance Goals**: NFR-001 through NFR-005 per spec

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + Playwright, full pyramid.
- **Coverage + traceability**: PASS. >=85% baseline, FR-to-test traceability enforced.
- **Performance/local-first**: PASS. In-process, zero network dependency, sub-ms dispatch.
- **Dockerless**: PASS. No container dependency.
- **Device-first**: PASS. All routing is local.

## Project Structure

### Source Code

```
apps/runtime/src/protocol/
├── bus.ts              # Core bus: dispatch, publish, subscribe, method/topic registries
├── envelope.ts         # Envelope creation, validation, schema types
├── methods.ts          # Method registry and handler binding
├── topics.ts           # Topic registry, subscriber management, sequencing
├── errors.ts           # Error taxonomy types and constructors
└── types.ts            # Shared type definitions (Envelope, Handler, Subscriber)

specs/protocol/v1/
├── envelope.schema.json
├── methods.json
└── topics.json
```

### Planning Artifacts

```
kitty-specs/002-local-bus-v1-protocol-and-envelope/
├── spec.md
├── plan.md
└── tasks.md
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Re-entrant dispatch support | Handlers must be able to send commands during execution without deadlock | Simple mutex would deadlock on nested dispatch |
| Per-topic monotonic sequencing | Deterministic ordering required by spec; global counter would serialize all topics unnecessarily | Global sequence counter creates a contention bottleneck at 10k msg/s |

## Quality Gate Enforcement

- Line coverage >= 85%; protocol-critical modules (bus.ts, envelope.ts) target >= 95%.
- FR-to-test traceability: every FR-00x maps to at least one named test.
- Fail closed on lint, type-check, and test gate violations.
- Protocol parity checks: runtime registries validated against `specs/protocol/v1/methods.json` and `specs/protocol/v1/topics.json`.
- Latency microbenchmarks run in CI; SLO breach fails the build.
