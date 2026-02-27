# Work Packages: Performance Baseline and Instrumentation

**Inputs**: Design documents from `/kitty-specs/006-performance-baseline-and-instrumentation/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the feature spec requires sub-millisecond measurement overhead, accurate percentile computation, and rate-limited SLO violation events.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/006-performance-baseline-and-instrumentation/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/` and `kitty-specs/`.

---

## Work Package WP01: Instrumentation Hooks and Timer API (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Implement the core instrumentation API: `markStart`/`markEnd`, monotonic clock wrapper, metric registration, and bounded ring buffer for sample storage.
**Independent Test**: Timing hooks produce accurate latency measurements; ring buffer bounds memory; monotonic clock never goes backward.
**Prompt**: `/kitty-specs/006-performance-baseline-and-instrumentation/tasks/WP01-instrumentation-hooks-and-timer-api.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [x] T001 Define metric, sample, and buffer types in `apps/runtime/src/diagnostics/types.ts`
- [x] T002 Implement monotonic clock wrapper in `apps/runtime/src/diagnostics/hooks.ts`
- [x] T003 Implement `markStart`/`markEnd` API with zero-allocation hot path in `apps/runtime/src/diagnostics/hooks.ts`
- [x] T004 Implement bounded ring buffer for sample storage in `apps/runtime/src/diagnostics/metrics.ts`
- [x] T005 Implement metric registration and sample recording in `apps/runtime/src/diagnostics/metrics.ts`
- [x] T006 [P] Add Vitest unit tests for hooks, ring buffer, and metric registration in `apps/runtime/tests/unit/diagnostics/`

### Implementation Notes
- Monotonic clock: `performance.now()` or equivalent — never `Date.now()`.
- Zero-allocation hot path: `markStart` returns a numeric handle (index into pre-allocated array), not an object.
- Ring buffer: configurable capacity (default 10,000 samples per metric), drop oldest on overflow with overflow counter.
- Metric types: latency, gauge, counter.

### Parallel Opportunities
- T006 can proceed once T003/T004/T005 APIs are stable.

### Dependencies
- None.

### Risks & Mitigations
- Risk: pre-allocated array sizing wastes memory if many metrics are registered.
- Mitigation: lazy allocation per metric; only allocate buffer on first sample.

---

## Work Package WP02: Rolling Percentiles and SLO Definitions (Priority: P1)

**Phase**: Phase 2 - Statistics
**Goal**: Implement rolling percentile computation (p50/p95/p99/min/max/count), SLO threshold definitions from the constitution, memory and frame timing samplers, and metrics query API.
**Independent Test**: Percentiles are accurate for known distributions; SLO thresholds match constitution; memory sampler records at configured intervals.
**Prompt**: `/kitty-specs/006-performance-baseline-and-instrumentation/tasks/WP02-rolling-percentiles-and-slo-definitions.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T007 Implement rolling percentile computation over ring buffer in `apps/runtime/src/diagnostics/percentiles.ts`
- [ ] T008 Define SLO thresholds from constitution in `apps/runtime/src/diagnostics/slo.ts`
- [ ] T009 Implement memory sampler (interval-based) in `apps/runtime/src/diagnostics/samplers.ts`
- [ ] T010 Implement frame timing sampler with FPS flagging in `apps/runtime/src/diagnostics/samplers.ts`
- [ ] T011 Implement metrics query API in `apps/runtime/src/diagnostics/query.ts`
- [ ] T012 [P] Add Vitest unit tests for percentiles, SLO definitions, samplers, and query API in `apps/runtime/tests/unit/diagnostics/`

### Implementation Notes
- Rolling percentiles: compute over the full ring buffer (sliding window = buffer capacity).
- Algorithm: sort-based for accuracy (buffer is bounded at 10k; sort is cheap).
- SLO definitions: input-to-echo p50<30ms/p95<60ms, input-to-render p50<60ms/p95<150ms, 60 FPS, <500MB memory, <2s startup.
- Memory sampler: use `process.memoryUsage()` or Bun equivalent.
- Frame timing: define hook point; actual wiring to renderer is post-MVP (specs 010-013).

### Parallel Opportunities
- T012 can proceed once T007/T008/T011 APIs are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: sort-based percentile is slow for large buffers.
- Mitigation: 10k sort is < 1ms; if needed, switch to streaming quantile algorithm.

---

## Work Package WP03: Violation Events, Bus Integration, and Tests (Priority: P1)

**Phase**: Phase 3 - Alerting
**Goal**: Implement rate-limited SLO violation event emission via the bus, integrate instrumentation hooks with bus lifecycle, and run comprehensive integration tests and overhead microbenchmarks.
**Independent Test**: Violation events fire when thresholds are breached; rate limiting prevents event storms; instrumentation overhead < 0.1ms per measurement.
**Prompt**: `/kitty-specs/006-performance-baseline-and-instrumentation/tasks/WP03-violation-events-bus-integration-and-tests.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T013 Implement SLO violation detection and rate-limited event emission in `apps/runtime/src/diagnostics/slo.ts`
- [ ] T014 Wire violation events to bus (`perf.slo_violation` topic) in `apps/runtime/src/diagnostics/slo.ts`
- [ ] T015 Implement periodic SLO check loop (configurable interval) in `apps/runtime/src/diagnostics/slo.ts`
- [ ] T016 [P] Add integration tests for violation detection, rate limiting, and bus emission in `apps/runtime/tests/integration/diagnostics/`
- [ ] T017 [P] Add overhead microbenchmarks (<0.1ms per measurement) in `apps/runtime/tests/bench/diagnostics/`
- [ ] T018 [P] Add memory overhead test (<10 MB total for all metric buffers) in `apps/runtime/tests/bench/diagnostics/`

### Implementation Notes
- Rate limit: 1 violation event per metric per 10-second window.
- Violation check: compare current percentiles against SLO thresholds.
- Bus event payload: `{ metric: string; threshold: number; actual: number; percentile: string }`.
- Bus integration uses spec 002 — stub if not available.
- Periodic check interval: configurable, default 5 seconds.

### Parallel Opportunities
- T016, T017, and T018 can all proceed in parallel once T013/T014/T015 are stable.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: periodic SLO check adds latency to event loop.
- Mitigation: run check in microtask with bounded computation time.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 is P0; WP02 and WP03 are P1 but required for SLO enforcement.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Metric, sample, buffer types | WP01 | P0 | No |
| T002 | Monotonic clock wrapper | WP01 | P0 | No |
| T003 | markStart/markEnd API | WP01 | P0 | No |
| T004 | Bounded ring buffer | WP01 | P0 | No |
| T005 | Metric registration + recording | WP01 | P0 | No |
| T006 | Hooks/buffer/registration unit tests | WP01 | P0 | Yes |
| T007 | Rolling percentile computation | WP02 | P1 | No |
| T008 | SLO threshold definitions | WP02 | P1 | No |
| T009 | Memory sampler | WP02 | P1 | No |
| T010 | Frame timing sampler | WP02 | P1 | No |
| T011 | Metrics query API | WP02 | P1 | No |
| T012 | Percentiles/SLO/sampler/query tests | WP02 | P1 | Yes |
| T013 | SLO violation detection + rate limiting | WP03 | P1 | No |
| T014 | Violation events on bus | WP03 | P1 | No |
| T015 | Periodic SLO check loop | WP03 | P1 | No |
| T016 | Violation + rate limit integration tests | WP03 | P1 | Yes |
| T017 | Overhead microbenchmarks | WP03 | P1 | Yes |
| T018 | Memory overhead test | WP03 | P1 | Yes |
