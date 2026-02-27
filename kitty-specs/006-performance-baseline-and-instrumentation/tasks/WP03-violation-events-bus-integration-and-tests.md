---
work_package_id: WP03
title: Violation Events, Bus Integration, and Tests
lane: "doing"
dependencies: [WP02]
base_branch: 006-performance-baseline-and-instrumentation-WP02
base_commit: 4c3c1e5e6e3a6398e086fc573e8dd58f023becc7
created_at: '2026-02-27T11:57:54.453547+00:00'
subtasks: [T013, T014, T015, T016, T017, T018]
phase: Phase 3 - Alerting
assignee: ''
agent: "claude-wp03-006"
shell_pid: "50383"
---

# Work Package Prompt: WP03 - Violation Events, Bus Integration, and Tests

## Objectives & Success Criteria

- Implement SLO violation detection with rate-limited event emission.
- Wire violation events to the bus as `perf.slo_violation` topic.
- Implement a periodic SLO check loop.
- Validate violation detection, rate limiting, and instrumentation overhead through integration tests and microbenchmarks.

Success criteria:
- SLO violations detected within one check interval of threshold breach.
- Rate limiting enforces max 1 event per metric per 10-second window.
- Bus events carry correct metric name, threshold, actual value, and percentile.
- Instrumentation overhead < 0.1ms per measurement point.
- Total buffer memory < 10 MB.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/006-performance-baseline-and-instrumentation/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/006-performance-baseline-and-instrumentation/spec.md`
- WP01/WP02 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/percentiles.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`

Constraints:
- Rate limit: 1 violation event per metric per 10-second window.
- Bus uses spec 002 — stub if not available.
- Periodic check interval configurable (default 5 seconds).
- Check computation must not block event loop for > 5ms.

## Subtasks & Detailed Guidance

### Subtask T013 - Implement SLO violation detection and rate limiting

- Purpose: detect when metrics breach SLO thresholds and limit event frequency.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`, implement `SLOMonitor` class.
  2. Constructor takes `MetricsRegistry` and `SLODefinition[]`.
  3. `checkAll(): SLOViolationEvent[]` — for each SLO definition:
     - Get metric's ring buffer from registry.
     - Compute percentiles.
     - Check against threshold.
     - If violated, create `SLOViolationEvent`.
     - Apply rate limiter: skip if this metric emitted a violation within the last 10 seconds.
  4. Implement rate limiter: `Map<string, number>` tracking last emission timestamp per metric.
  5. `resetRateLimiter(): void` — for testing.
  6. `setRateLimitWindowMs(ms: number): void` — configurable for testing.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`
- Validation checklist:
  - [ ] Violation detected when metric exceeds threshold.
  - [ ] No violation emitted when metric is within threshold.
  - [ ] Rate limiter suppresses duplicate violations within 10-second window.
  - [ ] Rate limiter allows new violation after window expires.
  - [ ] Each metric has independent rate limit tracking.
- Edge cases:
  - Metric has no samples — no violation (no data = no breach).
  - Multiple SLOs on same metric (e.g., p50 and p95) — each is independently rate-limited.
  - Rate limiter reset on metric re-registration.
- Parallel: No.

### Subtask T014 - Wire violation events to bus

- Purpose: publish SLO violation events to the local bus for subscriber notification.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`, add bus integration to `SLOMonitor`.
  2. Constructor takes optional bus publish function: `(topic: string, payload: unknown) => void`.
  3. After `checkAll()` produces violation events, publish each to bus topic `perf.slo_violation`.
  4. Event payload: `SLOViolationEvent` object (metric, percentile, threshold, actual, timestamp).
  5. Bus errors do not fail the check loop — log and continue.
  6. If bus is not provided, log violations to console instead.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`
- Validation checklist:
  - [ ] Bus event published with correct topic and payload.
  - [ ] Bus error does not crash monitor.
  - [ ] No bus available — fallback to console logging.
  - [ ] Event payload includes all required fields.
- Edge cases:
  - Bus publish is async — await it with timeout to prevent blocking check loop.
- Parallel: No.

### Subtask T015 - Implement periodic SLO check loop

- Purpose: automatically detect and report SLO violations at regular intervals.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`, add check loop to `SLOMonitor`.
  2. `start(intervalMs?: number): void` — begin periodic `checkAll()` using `setInterval`. Default 5000ms.
  3. `stop(): void` — clear interval.
  4. Guard against multiple `start()` calls — clear previous interval first.
  5. Add computation budget guard: if `checkAll()` takes > 5ms, log warning.
  6. Run `checkAll()` in a microtask to avoid blocking the event loop.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`
- Validation checklist:
  - [ ] Check loop fires at configured interval.
  - [ ] `stop()` halts the loop cleanly.
  - [ ] Double `start()` does not create duplicate intervals.
  - [ ] Long computation logged as warning.
- Edge cases:
  - Check takes longer than interval — next check is deferred, not overlapping.
  - System under heavy load — interval may drift; this is acceptable.
- Parallel: No.

### Subtask T016 - Add integration tests for violations and rate limiting

- Purpose: verify end-to-end violation detection, rate limiting, and bus emission.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/diagnostics/slo.test.ts`.
  2. Test violation detection: register metric, record samples exceeding SLO, run checkAll, verify violation event.
  3. Test no violation: record samples within SLO, verify no violation.
  4. Test rate limiting: trigger violation twice within 10s, verify only one event emitted.
  5. Test rate limit expiry: trigger violation, wait 10s (with fake timers), trigger again, verify second event emitted.
  6. Test bus emission: mock bus publish, verify event topic and payload.
  7. Test bus error isolation: mock bus that throws, verify check continues.
  8. Test periodic loop: start monitor, record violating samples, verify events fire within one interval.
  9. Add FR traceability: `// FR-004`, `// FR-010`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/diagnostics/slo.test.ts`
- Validation checklist:
  - [ ] >= 10 test cases.
  - [ ] FR traceability comments present.
  - [ ] Tests use fake timers for rate limit window.
- Edge cases:
  - Multiple metrics violating simultaneously — all emit (each has independent rate limit).
  - Metric oscillating around threshold — events fire, get rate-limited, fire again after window.
- Parallel: Yes (after T013/T014/T015 are stable).

### Subtask T017 - Add overhead microbenchmarks

- Purpose: prove instrumentation overhead meets < 0.1ms requirement.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/diagnostics/hooks-bench.ts`.
  2. Benchmark 1: `markStart` + `markEnd` cycle — 100,000 iterations. Measure overhead (total time minus simulated work). Assert overhead p99 < 0.1ms per cycle.
  3. Benchmark 2: `record` call (direct sample recording) — 100,000 iterations. Assert p99 < 0.05ms.
  4. Benchmark 3: `computePercentiles` on 10,000-sample buffer — 1,000 iterations. Assert p99 < 1ms.
  5. Benchmark 4: `checkAll` with 10 SLO definitions — 1,000 iterations. Assert p99 < 5ms.
  6. Output structured JSON results.
  7. Warm-up phase: skip first 100 iterations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/diagnostics/hooks-bench.ts`
- Validation checklist:
  - [ ] All benchmarks produce structured output.
  - [ ] p99 thresholds asserted.
  - [ ] Warm-up phase included.
- Edge cases:
  - CI machine factor — use 2x threshold.
- Parallel: Yes (after WP02 is stable).

### Subtask T018 - Add memory overhead test

- Purpose: verify total instrumentation memory stays within 10 MB budget.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/diagnostics/memory-bench.ts`.
  2. Register 20 metrics with 10,000 sample buffers each.
  3. Fill all buffers completely.
  4. Measure heap usage before and after.
  5. Assert total overhead < 10 MB.
  6. Breakdown: 20 metrics x 10k samples x 16 bytes (2 Float64) = ~3.2 MB. Plus overhead should stay well under 10 MB.
  7. Report per-metric and total memory usage.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/diagnostics/memory-bench.ts`
- Validation checklist:
  - [ ] Total memory < 10 MB with 20 metrics x 10k samples.
  - [ ] Per-metric memory reported.
  - [ ] Assertion fails build on threshold breach.
- Edge cases:
  - Empty buffers (registered but no samples) should have near-zero overhead.
  - Buffer at half capacity should use proportional memory.
- Parallel: Yes (after WP01 is stable).

## Test Strategy

- Integration tests for violation detection and rate limiting use fake timers.
- Microbenchmarks enforce overhead SLOs with assertions.
- Memory tests verify budget compliance.
- All tests are deterministic and reproducible.

## Risks & Mitigations

- Risk: periodic check blocks event loop under load.
- Mitigation: computation budget guard warns; defer to microtask.

## Review Guidance

- Confirm rate limiter is per-metric, not global.
- Confirm bus errors never crash the monitor.
- Confirm benchmarks fail on threshold breach.
- Confirm memory test accounts for Float64Array overhead correctly.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:57:54Z – claude-wp03-006 – shell_pid=50383 – lane=doing – Assigned agent via workflow command
