---
work_package_id: WP02
title: Rolling Percentiles and SLO Definitions
lane: "for_review"
dependencies: [WP01]
base_branch: 006-performance-baseline-and-instrumentation-WP01
base_commit: 4c3c1e5e6e3a6398e086fc573e8dd58f023becc7
created_at: '2026-02-27T11:57:52.976552+00:00'
subtasks: [T007, T008, T009, T010, T011, T012]
phase: Phase 2 - Statistics
assignee: ''
agent: "claude-wp02-006"
shell_pid: "50273"
---

# Work Package Prompt: WP02 - Rolling Percentiles and SLO Definitions

## Objectives & Success Criteria

- Implement rolling percentile computation over ring buffers.
- Define SLO thresholds from the constitution.
- Implement memory and frame timing samplers.
- Provide metrics query API for retrieving current statistics.

Success criteria:
- Percentile computation is accurate for known distributions (verified against reference values).
- SLO definitions match constitution: input-to-echo p50<30ms/p95<60ms, input-to-render p50<60ms/p95<150ms, 60 FPS, <500MB, <2s startup.
- Memory sampler records at configured intervals.
- Query API returns statistics within 1ms.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/006-performance-baseline-and-instrumentation/plan.md`
- WP01 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/hooks.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/metrics.ts`

Constraints:
- Percentile computation < 1ms for 10k samples.
- Memory overhead < 10 MB total.
- Frame timing hook is defined here but wired to renderer later (specs 010-013).

## Subtasks & Detailed Guidance

### Subtask T007 - Implement rolling percentile computation

- Purpose: compute p50/p95/p99/min/max/count statistics over ring buffer contents.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/percentiles.ts`.
  2. Implement `computePercentiles(buffer: RingBuffer): PercentileBucket`.
  3. Algorithm:
     - Get valid values from buffer.
     - If count === 0, return zeroed bucket.
     - Copy values to temp array (avoid mutating buffer).
     - Sort temp array.
     - p50 = value at index `Math.floor(count * 0.50)`.
     - p95 = value at index `Math.floor(count * 0.95)`.
     - p99 = value at index `Math.floor(count * 0.99)`.
     - min = first sorted value.
     - max = last sorted value.
     - count = number of values.
  4. Optimize: re-use temp array across calls (avoid allocation per computation).
  5. Export `computePercentiles`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/percentiles.ts`
- Validation checklist:
  - [ ] Known distribution [1..100] produces p50=50, p95=95, p99=99.
  - [ ] Empty buffer returns zeroed bucket.
  - [ ] Single-sample buffer returns that value for all percentiles.
  - [ ] Sort is on a copy, not the original buffer.
- Edge cases:
  - Buffer with all identical values — all percentiles equal that value.
  - Buffer with 2 samples — p99 = max.
  - NaN values in buffer — filter before computing.
- Parallel: No.

### Subtask T008 - Define SLO thresholds from constitution

- Purpose: codify performance targets as machine-readable SLO definitions.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`.
  2. Define `SLO_DEFINITIONS` array of `SLODefinition`:
     - `{ metric: 'input-to-echo', percentile: 'p50', threshold: 30, unit: 'ms' }`
     - `{ metric: 'input-to-echo', percentile: 'p95', threshold: 60, unit: 'ms' }`
     - `{ metric: 'input-to-render', percentile: 'p50', threshold: 60, unit: 'ms' }`
     - `{ metric: 'input-to-render', percentile: 'p95', threshold: 150, unit: 'ms' }`
     - `{ metric: 'fps', percentile: 'p50', threshold: 60, unit: 'fps' }` (minimum, not maximum)
     - `{ metric: 'memory', percentile: 'p95', threshold: 500, unit: 'MB' }`
     - `{ metric: 'startup-to-interactive', percentile: 'p95', threshold: 2000, unit: 'ms' }`
  3. Implement `getSLOsForMetric(metric: string): SLODefinition[]`.
  4. Implement `checkSLO(slo: SLODefinition, bucket: PercentileBucket): { passed: boolean; actual: number }`.
  5. For FPS: violation is when actual < threshold (inverse of latency).
  6. For memory: compare gauge value, not percentile.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/slo.ts`
- Validation checklist:
  - [ ] All constitution SLOs are represented.
  - [ ] `checkSLO` correctly detects violations for each metric type.
  - [ ] FPS check is inverted (lower is worse).
  - [ ] SLO definitions are frozen (immutable).
- Edge cases:
  - Metric with no SLO — `getSLOsForMetric` returns empty array.
  - Zero-count bucket — SLO check passes (no data = no violation).
- Parallel: No.

### Subtask T009 - Implement memory sampler

- Purpose: track memory consumption at regular intervals for trend analysis.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/samplers.ts`.
  2. Implement `MemorySampler` class:
     - Constructor takes `MetricsRegistry` and `intervalMs: number` (default 5000).
     - `start(): void` — begin periodic sampling using `setInterval`.
     - `stop(): void` — clear interval.
     - On each tick: read `process.memoryUsage().heapUsed` (or Bun equivalent), convert to MB, record to `memory` metric.
  3. Register `memory` metric on construction: `{ name: 'memory', type: 'gauge', unit: 'MB' }`.
  4. Export `MemorySampler`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/samplers.ts`
- Validation checklist:
  - [ ] Sampler records at configured interval.
  - [ ] Values are in MB (not bytes).
  - [ ] `stop()` halts sampling cleanly.
  - [ ] Multiple `start()` calls don't create duplicate intervals.
- Edge cases:
  - `process.memoryUsage` not available in all Bun contexts — fallback with warning.
  - Very short interval (100ms) — should work but with warning about overhead.
- Parallel: No.

### Subtask T010 - Implement frame timing sampler

- Purpose: define frame timing measurement hooks for future renderer integration.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/samplers.ts`, implement `FrameTimingSampler` class.
  2. Register `fps` metric: `{ name: 'fps', type: 'gauge', unit: 'fps' }`.
  3. Implement `recordFrame(timestamp: number): void` — called by renderer on each frame.
     - Track frame count and timestamps within 1-second windows.
     - At each window boundary, compute FPS and record to metric.
     - If FPS < 55, log warning.
  4. Implement `start(): void` / `stop(): void` for lifecycle management.
  5. Note: actual wiring to renderer is deferred to specs 010-013. This provides the hook.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/samplers.ts`
- Validation checklist:
  - [ ] 60 `recordFrame` calls in 1 second records FPS=60.
  - [ ] 30 calls in 1 second records FPS=30 and logs warning.
  - [ ] Window boundary transitions correctly.
  - [ ] Multiple windows produce independent FPS values.
- Edge cases:
  - No frames recorded for a full second — record FPS=0.
  - Very high FPS (>120) — record accurately, no cap.
- Parallel: No.

### Subtask T011 - Implement metrics query API

- Purpose: provide a read API for retrieving current statistics for any metric.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/query.ts`.
  2. Implement `MetricsQuery` class:
     - Constructor takes `MetricsRegistry`.
     - `getStats(metric: string): PercentileBucket | null` — compute percentiles for the named metric's ring buffer. Return null if metric not found.
     - `getAllStats(): Record<string, PercentileBucket>` — compute percentiles for all registered metrics.
     - `getRawSamples(metric: string, limit?: number): Sample[]` — return recent raw samples.
  3. Query latency must be < 1ms for a single metric (sort 10k values).
  4. Export `MetricsQuery`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/diagnostics/query.ts`
- Validation checklist:
  - [ ] `getStats` returns correct percentiles.
  - [ ] Unknown metric returns null.
  - [ ] `getAllStats` includes all registered metrics.
  - [ ] `getRawSamples` respects limit parameter.
- Edge cases:
  - Metric registered but never recorded — return zeroed bucket.
  - Query during active recording — read from consistent buffer snapshot.
- Parallel: No.

### Subtask T012 - Add Vitest unit tests

- Purpose: verify percentile accuracy, SLO checks, sampler behavior, and query API.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/percentiles.test.ts`.
  2. Test with known distributions: [1..100], all-same, single value, two values.
  3. Test empty buffer returns zeroed bucket.
  4. Test NaN filtering.
  5. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/slo.test.ts`.
  6. Test each SLO definition against passing and failing buckets.
  7. Test FPS inverse check.
  8. Test zero-count bucket passes.
  9. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/samplers.test.ts`.
  10. Test memory sampler: start, wait interval, verify sample recorded, stop.
  11. Test frame timing: simulate 60 fps, verify FPS=60 recorded.
  12. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/query.test.ts`.
  13. Test `getStats`, `getAllStats`, `getRawSamples`.
  14. Add FR traceability: `// FR-002`, `// FR-003`, `// FR-005`, `// FR-006`, `// FR-007`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/percentiles.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/slo.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/samplers.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/diagnostics/query.test.ts`
- Validation checklist:
  - [ ] >= 25 test cases across all files.
  - [ ] FR traceability comments present.
  - [ ] Sampler tests use fake timers.
- Edge cases:
  - Test percentiles with very skewed distributions (all values the same except one outlier).
- Parallel: Yes (after T007/T008/T011 APIs are stable).

## Test Strategy

- Unit tests for percentile accuracy using known distributions.
- SLO checks tested with both passing and failing data.
- Sampler tests use fake timers to avoid wall-clock delays.
- Query tests verify computation correctness and edge cases.

## Risks & Mitigations

- Risk: sort-based percentile is too slow for large buffers.
- Mitigation: 10k sort is < 1ms; benchmark confirms.

## Review Guidance

- Confirm percentile indices match standard definitions.
- Confirm SLO definitions match constitution exactly.
- Confirm FPS check is inverted (lower = worse).
- Confirm samplers clean up on stop.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:57:53Z – claude-wp02-006 – shell_pid=50273 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:03:25Z – claude-wp02-006 – shell_pid=50273 – lane=for_review – Ready for review
