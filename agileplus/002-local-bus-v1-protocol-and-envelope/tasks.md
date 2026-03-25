# Work Packages: Local Bus v1 Protocol and Envelope

**Inputs**: Design documents from `/kitty-specs/002-local-bus-v1-protocol-and-envelope/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the feature spec requires strict validation of envelope integrity, sequencing, and error taxonomy.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/002-local-bus-v1-protocol-and-envelope/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Envelope Schema, Types, and Validation (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Define the envelope schema, TypeScript types, creation helpers, and strict validation. Establish the error taxonomy and JSON schema assets.
**Independent Test**: Envelope creation produces valid structures; validation rejects all malformed payloads; error taxonomy types compile and serialize correctly.
**Prompt**: `/kitty-specs/002-local-bus-v1-protocol-and-envelope/tasks/WP01-envelope-schema-types-and-validation.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [x] T001 Define envelope TypeScript interfaces and discriminated unions in `apps/runtime/src/protocol/types.ts`
- [x] T002 Define error taxonomy types and constructors in `apps/runtime/src/protocol/errors.ts`
- [x] T003 Implement envelope creation helpers with ID generation and timestamp in `apps/runtime/src/protocol/envelope.ts`
- [x] T004 Implement strict envelope validation (schema check, required fields, payload size limit) in `apps/runtime/src/protocol/envelope.ts`
- [x] T005 [P] Create JSON schema assets in `specs/protocol/v1/envelope.schema.json`
- [x] T006 [P] Add Vitest unit tests for envelope creation, validation, and error taxonomy in `apps/runtime/tests/unit/protocol/`

### Implementation Notes
- Envelope interfaces must use discriminated unions to separate command, response, and event envelope shapes.
- Error taxonomy: `VALIDATION_ERROR`, `METHOD_NOT_FOUND`, `HANDLER_ERROR`, `TIMEOUT`, `BACKPRESSURE`.
- Validation must be fail-fast: reject before routing.
- Payload size limit configurable, default 1 MB.

### Parallel Opportunities
- T005 and T006 can proceed once T001/T002 type contracts are stable.

### Dependencies
- None.

### Risks & Mitigations
- Risk: type definitions diverge from JSON schema.
- Mitigation: derive runtime literal unions from schema where practical; test round-trip consistency.

---

## Work Package WP02: Method and Topic Registries with Dispatch (Priority: P0)

**Phase**: Phase 2 - Core Routing
**Goal**: Implement method registry (register handler, dispatch command, return correlated response) and topic registry (subscribe, publish, fan-out) with deterministic delivery and subscriber isolation.
**Independent Test**: Commands dispatch to registered handlers and return correlated responses; events fan out to all subscribers in deterministic order; subscriber failures are isolated.
**Prompt**: `/kitty-specs/002-local-bus-v1-protocol-and-envelope/tasks/WP02-method-and-topic-registries-with-dispatch.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T007 Implement method registry with handler registration and lookup in `apps/runtime/src/protocol/methods.ts`
- [ ] T008 Implement command dispatch pipeline (validate envelope, route to handler, wrap response) in `apps/runtime/src/protocol/bus.ts`
- [ ] T009 Implement topic registry with subscriber management in `apps/runtime/src/protocol/topics.ts`
- [ ] T010 Implement event publish pipeline with fan-out, subscriber isolation, and correlation propagation in `apps/runtime/src/protocol/bus.ts`
- [ ] T011 Wire bus facade (unified send/publish/subscribe API) in `apps/runtime/src/protocol/bus.ts`
- [ ] T012 [P] Add Vitest unit tests for method dispatch, topic fan-out, subscriber isolation, and re-entrant safety in `apps/runtime/tests/unit/protocol/`

### Implementation Notes
- Method handlers are 1:1 (one handler per method name); duplicate registration is an error.
- Topic subscribers are 1:N (multiple subscribers per topic).
- Re-entrant dispatch must be supported: a handler can send commands during its own execution without deadlock.
- Subscriber isolation: one subscriber throwing does not prevent delivery to others.

### Parallel Opportunities
- T012 can proceed after T008/T010 dispatch interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: re-entrant dispatch causes stack overflow under deep nesting.
- Mitigation: add configurable re-entrant depth limit with clear error at threshold.

---

## Work Package WP03: Event Sequencing, Error Taxonomy Integration, and Tests (Priority: P1)

**Phase**: Phase 3 - Hardening
**Goal**: Add per-topic monotonic sequence numbers, correlation ID propagation from commands through downstream events, payload size enforcement, and comprehensive integration tests including load and ordering validation.
**Independent Test**: Sequence numbers are monotonic across 10k concurrent publishes; correlation IDs propagate from commands to all downstream events; latency SLOs met under sustained load.
**Prompt**: `/kitty-specs/002-local-bus-v1-protocol-and-envelope/tasks/WP03-event-sequencing-error-taxonomy-and-tests.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T013 Implement per-topic monotonic sequence number assignment in `apps/runtime/src/protocol/topics.ts`
- [ ] T014 Implement correlation ID propagation from originating command through all downstream events in `apps/runtime/src/protocol/bus.ts`
- [ ] T015 Implement payload size enforcement and backpressure error in `apps/runtime/src/protocol/envelope.ts`
- [x] T016 [P] Add integration tests for 10k concurrent publishes verifying zero sequence inversions in `apps/runtime/tests/integration/protocol/`
- [x] T017 [P] Add latency microbenchmarks for dispatch (<1ms) and fan-out (<5ms for 50 subs) in `apps/runtime/tests/bench/protocol/`
- [x] T018 [P] Validate JSON schema parity with runtime types and add regression test in `apps/runtime/tests/unit/protocol/`

### Implementation Notes
- Sequence numbers are per-topic counters, not global.
- Concurrent publish from multiple subsystems must still produce monotonic sequences (serialize within topic).
- Correlation ID context flows through a scoped propagation mechanism, not a global variable.
- Microbenchmarks enforce NFR-001 through NFR-005 per spec.

### Parallel Opportunities
- T016, T017, and T018 can all proceed in parallel once T013/T014 are stable.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: per-topic serialization becomes a bottleneck at 10k msg/s.
- Mitigation: benchmark early; consider lock-free counter if contention appears.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: All three WPs are MVP-critical; WP01 and WP02 are P0, WP03 is P1.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Envelope TypeScript interfaces and unions | WP01 | P0 | No |
| T002 | Error taxonomy types and constructors | WP01 | P0 | No |
| T003 | Envelope creation helpers | WP01 | P0 | No |
| T004 | Strict envelope validation | WP01 | P0 | No |
| T005 | JSON schema assets | WP01 | P0 | Yes |
| T006 | Envelope and error unit tests | WP01 | P0 | Yes |
| T007 | Method registry implementation | WP02 | P0 | No |
| T008 | Command dispatch pipeline | WP02 | P0 | No |
| T009 | Topic registry implementation | WP02 | P0 | No |
| T010 | Event publish pipeline with fan-out | WP02 | P0 | No |
| T011 | Bus facade API | WP02 | P0 | No |
| T012 | Method/topic dispatch unit tests | WP02 | P0 | Yes |
| T013 | Per-topic monotonic sequencing | WP03 | P1 | No |
| T014 | Correlation ID propagation | WP03 | P1 | No |
| T015 | Payload size enforcement | WP03 | P1 | No |
| T016 | Concurrent ordering integration tests | WP03 | P1 | Yes |
| T017 | Latency microbenchmarks | WP03 | P1 | Yes |
| T018 | Schema parity regression test | WP03 | P1 | Yes |
