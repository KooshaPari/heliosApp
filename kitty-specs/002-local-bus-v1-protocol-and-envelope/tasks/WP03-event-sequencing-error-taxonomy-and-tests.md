---
work_package_id: WP03
title: Event Sequencing, Error Taxonomy Integration, and Tests
lane: "doing"
dependencies: [WP02]
base_branch: 002-local-bus-v1-protocol-and-envelope-WP02
base_commit: 8377f7da306441de443674fe9f2fddbadd8b502f
created_at: '2026-02-27T11:50:39.812822+00:00'
subtasks: [T013, T014, T015, T016, T017, T018]
phase: Phase 3 - Hardening
assignee: ''
agent: ''
shell_pid: "37905"
---

# Work Package Prompt: WP03 - Event Sequencing, Error Taxonomy Integration, and Tests

## Objectives & Success Criteria

- Add per-topic monotonic sequence numbers to guarantee deterministic event ordering.
- Implement correlation ID propagation from originating commands through all downstream events.
- Enforce payload size limits with backpressure errors.
- Validate ordering, latency SLOs, and schema parity through comprehensive integration tests and benchmarks.

Success criteria:
- 10,000 concurrent publishes produce zero sequence inversions per topic.
- Correlation IDs flow from command origin through all downstream events.
- Oversized payloads are rejected with BACKPRESSURE error.
- Dispatch latency < 1ms (p95); fan-out to 50 subscribers < 5ms (p95).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/002-local-bus-v1-protocol-and-envelope/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/002-local-bus-v1-protocol-and-envelope/spec.md`
- WP01/WP02 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/envelope.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/errors.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/methods.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/topics.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/specs/protocol/v1/envelope.schema.json`

Constraints:
- Per-topic sequence counters, not global (avoid serialization bottleneck).
- Correlation context must be scoped, not global (support concurrent commands).
- Benchmarks run in CI; SLO breach fails the build.

## Subtasks & Detailed Guidance

### Subtask T013 - Implement per-topic monotonic sequence numbers

- Purpose: guarantee deterministic event ordering within each topic.
- Steps:
  1. Open `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/topics.ts`.
  2. Add a `Map<string, number>` to `TopicRegistry` for per-topic sequence counters.
  3. On `publish`, before delivering to subscribers, atomically increment the topic counter and assign to `event.sequence`.
  4. Ensure the counter increment and subscriber delivery are serialized within each topic to prevent out-of-order assignment under concurrent publishes.
  5. Initialize counter at 0 for new topics; first event gets sequence 1.
  6. Add `getSequence(topic: string): number` for testing/observability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/topics.ts`
- Validation checklist:
  - [ ] First event on a topic gets sequence 1.
  - [ ] Concurrent publishes to same topic produce strictly increasing sequences.
  - [ ] Different topics have independent counters.
  - [ ] Sequence number is assigned before subscriber delivery.
- Edge cases:
  - Sequence counter overflow at `Number.MAX_SAFE_INTEGER` — reset to 0 with logged warning.
  - Topic created by first publish (no prior subscribe) gets counter initialized.
- Parallel: No.

### Subtask T014 - Implement correlation ID propagation

- Purpose: enable end-to-end tracing from originating command through all downstream events.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`, implement a correlation context mechanism.
  2. Use `AsyncLocalStorage` (Node/Bun compatible) to store the active correlation_id during command dispatch.
  3. Before executing a handler, set the correlation context to the command's `correlation_id`.
  4. In the `publish` path, if an event has no `correlation_id` set, inherit from the active correlation context.
  5. After handler execution completes, clear the correlation context.
  6. Export `getActiveCorrelationId(): string | undefined` for subsystems that need to annotate custom events.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
- Validation checklist:
  - [ ] Events created inside a command handler inherit the command's correlation_id.
  - [ ] Events created outside any command context retain their own correlation_id.
  - [ ] Nested commands (re-entrant) each maintain their own correlation context.
  - [ ] `getActiveCorrelationId()` returns undefined outside dispatch.
- Edge cases:
  - Async handler with delayed event emission — `AsyncLocalStorage` propagates through await chains.
  - Concurrent commands — each has isolated correlation context.
- Parallel: No.

### Subtask T015 - Implement payload size enforcement

- Purpose: prevent oversized messages from consuming unbounded memory.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/envelope.ts`, update `validateEnvelope` to enforce `MAX_PAYLOAD_SIZE`.
  2. If payload exceeds limit, return `backpressureError(topic/method)` instead of generic validation error.
  3. Add fast-path: if payload is a primitive (string/number/boolean/null), skip size check for strings under 1 MB.
  4. For object payloads, use `JSON.stringify` length check with try/catch for circular references.
  5. Make `MAX_PAYLOAD_SIZE` configurable via bus constructor options.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/envelope.ts`
- Validation checklist:
  - [ ] Payload at exactly MAX_PAYLOAD_SIZE passes.
  - [ ] Payload at MAX_PAYLOAD_SIZE + 1 byte returns BACKPRESSURE error.
  - [ ] Circular reference payload returns VALIDATION_ERROR (not crash).
  - [ ] Primitive payloads under limit pass without serialization.
- Edge cases:
  - Buffer/ArrayBuffer payloads — check `.byteLength` directly.
  - Null payload — always passes size check.
- Parallel: No.

### Subtask T016 - Add concurrent ordering integration tests

- Purpose: prove monotonic sequencing under concurrent load.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/protocol/ordering.test.ts`.
  2. Test: publish 10,000 events to the same topic from multiple async contexts; collect received sequences; assert strictly increasing.
  3. Test: publish to 10 different topics concurrently; verify each topic has independent monotonic sequences.
  4. Test: correlation ID propagation — dispatch a command whose handler publishes 5 events; all events carry the command's correlation_id.
  5. Test: nested dispatch — command handler dispatches another command that publishes events; inner events carry inner correlation_id, not outer.
  6. Add FR traceability: `// FR-005`, `// FR-008`, `// FR-009`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/protocol/ordering.test.ts`
- Validation checklist:
  - [ ] Zero sequence inversions across 10k events.
  - [ ] Independent topic counters confirmed.
  - [ ] Correlation chain verified end-to-end.
- Edge cases:
  - Test with randomized delays between publishes to simulate real concurrency.
- Parallel: Yes (after T013/T014 are stable).

### Subtask T017 - Add latency microbenchmarks

- Purpose: enforce NFR-001 through NFR-005 SLOs in CI.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/protocol/bus-bench.ts`.
  2. Benchmark 1: command dispatch (send → handler → response) — measure p50, p95, p99. Assert p95 < 1ms.
  3. Benchmark 2: event fan-out to 50 subscribers — measure p95. Assert p95 < 5ms.
  4. Benchmark 3: envelope validation — measure p95. Assert p95 < 0.1ms.
  5. Benchmark 4: sustained throughput — 10,000 messages/second for 10 seconds. Assert zero loss and zero ordering violations.
  6. Output results in a machine-parseable format (JSON) for CI gate consumption.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/protocol/bus-bench.ts`
- Validation checklist:
  - [ ] All four benchmarks produce structured output.
  - [ ] p95 thresholds are asserted, not just reported.
  - [ ] Benchmarks warm up before measurement (skip first 100 iterations).
- Edge cases:
  - CI machines are slower than dev machines — thresholds must account for 2x slowdown factor.
- Parallel: Yes (after WP02 bus is functional).

### Subtask T018 - Validate JSON schema parity with runtime types

- Purpose: prevent schema/runtime divergence that causes silent compatibility breaks.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/schema-parity.test.ts`.
  2. Load `specs/protocol/v1/envelope.schema.json` at test time.
  3. Generate test envelopes using `createCommand`, `createResponse`, `createEvent`.
  4. Validate generated envelopes against JSON schema using a lightweight JSON Schema validator (e.g., Ajv or custom).
  5. Generate known-bad envelopes and confirm JSON schema also rejects them.
  6. Assert that every required field in the JSON schema is also required in the TypeScript types.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/schema-parity.test.ts`
- Validation checklist:
  - [ ] All generated envelopes pass JSON schema validation.
  - [ ] Known-bad envelopes fail JSON schema validation.
  - [ ] Required field sets match between TS types and JSON schema.
- Edge cases:
  - Schema allows `additionalProperties` but TS types don't — document this intentional divergence.
- Parallel: Yes (after WP01 schema is published).

## Test Strategy

- Integration tests for ordering use high-volume concurrent scenarios.
- Microbenchmarks enforce latency SLOs with assertions, not just measurements.
- Schema parity test runs on every commit to catch drift early.
- All tests must be deterministic and reproducible.

## Risks & Mitigations

- Risk: per-topic serialization adds latency under high contention.
- Mitigation: benchmark with realistic contention patterns; consider atomic increment if needed.
- Risk: `AsyncLocalStorage` has overhead in Bun.
- Mitigation: benchmark correlation propagation overhead; fallback to explicit parameter passing if overhead exceeds 0.1ms.

## Review Guidance

- Confirm sequence assignment happens atomically before subscriber delivery.
- Confirm correlation context is isolated per concurrent command.
- Confirm benchmarks fail the build on SLO breach.
- Confirm schema parity test catches field additions/removals.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
