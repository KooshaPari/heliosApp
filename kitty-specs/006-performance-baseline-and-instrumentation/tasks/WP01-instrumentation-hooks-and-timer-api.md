---
work_package_id: WP01
title: Instrumentation Hooks and Timer API
lane: "doing"
dependencies: []
base_branch: main
base_commit: 39f25bd2dd6b41645c93a63f333558a581a3f652
created_at: '2026-02-27T11:50:52.771440+00:00'
subtasks: [T001, T002, T003, T004, T005, T006]
phase: Phase 1 - Foundation
assignee: ''
agent: ''
shell_pid: "38561"
---

# Work Package Prompt: WP01 - Instrumentation Hooks and Timer API

## Objectives & Success Criteria

- Define metric types, sample structures, and ring buffer contract.
- Implement monotonic clock wrapper for all latency measurements.
- Implement zero-allocation `markStart`/`markEnd` API for the terminal input hot path.
- Implement bounded ring buffer for sample storage with overflow tracking.
- Implement metric registration and sample recording.

Success criteria:
- `markStart`/`markEnd` produce accurate latency values (verified against known delays).
- Ring buffer bounds memory at configured capacity with correct overflow behavior.
- Monotonic clock never produces negative durations.
- Per-measurement overhead < 0.1ms (p99).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/006-performance-baseline-and-instrumentation/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/006-performance-baseline-and-instrumentation/spec.md`
- Target directory: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/`

Constraints:
- Monotonic clock only (`performance.now()` or equivalent).
- Zero heap allocation on `markStart`/`markEnd` hot path.
- Ring buffer default 10,000 samples per metric; configurable.
- Total buffer memory < 10 MB for all metrics.
- Keep files under 350 lines.

## Subtasks & Detailed Guidance

### Subtask T001 - Define metric, sample, and buffer types

- Purpose: establish the type foundation for all instrumentation.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/types.ts`.
  2. Define `MetricType`: `'latency' | 'gauge' | 'counter'`.
  3. Define `MetricDefinition`: `{ name: string; type: MetricType; unit: string; description: string; bufferSize?: number }`.
  4. Define `Sample`: `{ timestamp: number; value: number; labels?: Record<string, string> }`.
  5. Define `PercentileBucket`: `{ p50: number; p95: number; p99: number; min: number; max: number; count: number }`.
  6. Define `SLODefinition`: `{ metric: string; percentile: 'p50' | 'p95' | 'p99'; threshold: number; unit: string }`.
  7. Define `SLOViolationEvent`: `{ metric: string; percentile: string; threshold: number; actual: number; timestamp: number }`.
  8. Export all types.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/types.ts`
- Validation checklist:
  - [ ] All types compile under `strict: true`.
  - [ ] `Sample.labels` is optional for zero-alloc path.
  - [ ] `PercentileBucket` includes all six statistics.
- Edge cases:
  - `labels` on hot path samples should be omitted (not empty object).
- Parallel: No.

### Subtask T002 - Implement monotonic clock wrapper

- Purpose: provide a single clock source for all latency measurements, preventing wall-clock artifacts.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`, implement `monotonicNow(): number`.
  2. Use `performance.now()` (returns milliseconds with sub-ms precision).
  3. Add a `MonotonicClock` interface for testability: `{ now(): number }`.
  4. Default implementation uses `performance.now()`.
  5. Export `monotonicNow` and `MonotonicClock`.
  6. Add assertion: if `performance.now` is unavailable, throw at module load (fail fast).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`
- Validation checklist:
  - [ ] Two sequential calls always return non-decreasing values.
  - [ ] Precision is sub-millisecond.
  - [ ] Testable via injectable clock interface.
- Edge cases:
  - `performance.now()` resolution varies by platform — document minimum expected precision.
- Parallel: No.

### Subtask T003 - Implement markStart/markEnd API

- Purpose: provide the primary instrumentation entry points with zero allocation.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`, implement the timing API.
  2. Pre-allocate a `Float64Array(MAX_CONCURRENT_MARKS)` (default 1024) for start timestamps.
  3. Maintain a `nextSlot` counter (circular index).
  4. `markStart(metric: string): number` — record `monotonicNow()` at `nextSlot`, return slot index. No object allocation.
  5. `markEnd(metric: string, handle: number): number` — compute duration as `monotonicNow() - startTimes[handle]`, record sample to metric buffer, return duration. No object allocation.
  6. If all slots are in use, overwrite oldest (circular buffer behavior with warning counter).
  7. Implement `getOverflowCount(): number` for diagnostics.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`
- Validation checklist:
  - [ ] `markStart` returns numeric handle, not an object.
  - [ ] `markEnd` computes correct duration for known delays.
  - [ ] No `new` keyword on hot path.
  - [ ] Overflow wraps correctly without crash.
  - [ ] Concurrent marks to different metrics don't interfere.
- Edge cases:
  - `markEnd` called with stale handle (overwritten slot) — detect and log, don't record bad sample.
  - `markEnd` called without prior `markStart` — return -1 or NaN, log warning.
- Parallel: No.

### Subtask T004 - Implement bounded ring buffer

- Purpose: store recent samples per metric with bounded memory.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`, implement `RingBuffer` class.
  2. Constructor takes `capacity: number` (default 10,000).
  3. Internal: `Float64Array(capacity)` for values, `Float64Array(capacity)` for timestamps.
  4. `push(value: number, timestamp: number): void` — write at next index, wrap on overflow.
  5. `getValues(): Float64Array` — return a view of current valid entries (not a copy for read-only consumers).
  6. `getCount(): number` — return number of recorded samples (up to capacity).
  7. `getOverflowCount(): number` — count of dropped oldest samples.
  8. `clear(): void` — reset buffer.
  9. Memory per buffer: ~160 KB for 10,000 samples (2 x 10,000 x 8 bytes).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`
- Validation checklist:
  - [ ] Buffer capacity is enforced (never exceeds).
  - [ ] Overflow drops oldest samples.
  - [ ] `getValues` returns only valid entries (not uninitialized slots).
  - [ ] Memory usage per buffer matches expectation.
- Edge cases:
  - Buffer with 0 samples — `getValues` returns empty view.
  - Buffer with exactly `capacity` samples — no overflow yet.
  - Buffer with `capacity + 1` samples — overflow count is 1.
- Parallel: No.

### Subtask T005 - Implement metric registration and recording

- Purpose: provide a central registry where subsystems register metrics and record samples.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`, implement `MetricsRegistry` class.
  2. `register(definition: MetricDefinition): void` — create ring buffer for metric, store definition.
  3. `record(name: string, value: number, timestamp?: number): void` — push sample to metric's ring buffer. Use `monotonicNow()` if timestamp not provided.
  4. `getMetric(name: string): { definition: MetricDefinition; buffer: RingBuffer } | undefined`.
  5. `listMetrics(): string[]` — all registered metric names.
  6. `unregister(name: string): void` — remove metric and free buffer.
  7. Lazy buffer allocation: buffer created on first `record`, not on `register`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`
- Validation checklist:
  - [ ] Registering same metric name twice throws.
  - [ ] Recording to unregistered metric is a no-op with warning.
  - [ ] `getMetric` returns definition and buffer.
  - [ ] Lazy allocation confirmed (no buffer until first record).
- Edge cases:
  - Recording with explicit timestamp — should use provided value, not monotonicNow().
  - Very high recording rate — ring buffer handles gracefully.
- Parallel: No.

### Subtask T006 - Add Vitest unit tests

- Purpose: lock instrumentation behavior before higher-level statistics work.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/hooks.test.ts`.
  2. Test `monotonicNow`: two calls return non-decreasing values.
  3. Test `markStart`/`markEnd`: measure a `setTimeout(10)`, verify duration is 8-15ms.
  4. Test zero-allocation: verify `markStart` returns number, not object.
  5. Test stale handle detection.
  6. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/metrics.test.ts`.
  7. Test `RingBuffer`: push within capacity, push beyond capacity (overflow), getValues correctness, overflow count.
  8. Test `MetricsRegistry`: register, record, getMetric, duplicate registration error, unregistered metric warning.
  9. Test lazy buffer allocation.
  10. Add FR traceability: `// FR-001`, `// FR-008`, `// FR-009`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/hooks.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/metrics.test.ts`
- Validation checklist:
  - [ ] >= 20 test cases.
  - [ ] FR traceability comments present.
  - [ ] Tests run in < 5 seconds.
- Edge cases:
  - Test with injectable mock clock for deterministic timing tests.
  - Test ring buffer with capacity=1 (extreme boundary).
- Parallel: Yes (after T003/T004/T005 APIs are stable).

## Test Strategy

- Unit tests for correctness with mock clock for deterministic results.
- Real timing tests for sanity (markStart/markEnd with actual delays).
- Ring buffer tests exercise all boundary conditions.

## Risks & Mitigations

- Risk: Float64Array pre-allocation is wasteful for metrics with few samples.
- Mitigation: lazy allocation defers until first record.

## Review Guidance

- Confirm zero allocation on markStart/markEnd path.
- Confirm monotonic clock is used everywhere (no Date.now).
- Confirm ring buffer overflow is tracked and reported.
- Confirm no `any` types in public API.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
