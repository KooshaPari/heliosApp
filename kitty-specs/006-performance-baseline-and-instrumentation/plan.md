# Implementation Plan: Performance Baseline and Instrumentation

**Branch**: `006-performance-baseline-and-instrumentation` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement the performance instrumentation layer: latency hooks for critical paths (input-to-echo, input-to-render, lane-create, session-restore, startup-to-interactive), rolling percentile statistics, memory and frame timing sampling, SLO threshold definitions from the constitution, and rate-limited violation events on the bus. This spec defines how we measure, not what we optimize.

## Scope Contract

- **In scope (this slice)**:
  - Instrumentation hooks: `markStart(metric)` / `markEnd(metric)` API for latency measurement.
  - Rolling percentile computation (p50, p95, p99, min, max, count) over bounded ring buffers.
  - SLO definitions: input-to-echo p50 <30ms / p95 <60ms, input-to-render p50 <60ms / p95 <150ms, 60 FPS, <500 MB memory, <2s startup.
  - `perf.slo_violation` bus events with rate limiting (1 per metric per 10s).
  - Memory sampling at configurable intervals (default 5s).
  - Frame timing sampling with <55 FPS flagging per 1s window.
  - Metrics query API returning current stats for any metric.
  - Monotonic clock source for all latency (no wall-clock).
  - Bounded ring buffer (default 10k samples/metric), drop oldest on overflow.
- **Deferred**:
  - Export to external observability systems (Prometheus, OpenTelemetry).
  - Persistent metrics storage or historical trend analysis.
  - Renderer frame callbacks (depends on specs 010-013; frame timing hooks are defined here but wired later).

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Bun, spec 002 (bus for violation events), spec 001 (startup timing hook point)
**Storage**: In-memory ring buffers only
**Testing**: Vitest for unit/integration, microbenchmarks for overhead validation
**Target Platform**: Local device-first desktop runtime (macOS, Linux reference hardware: 8 GB RAM, 4 cores)
**Constraints**: Dockerless, < 0.1ms p99 per measurement, zero heap allocation on terminal input hot path, < 10 MB total buffer memory
**Performance Goals**: NFR-001 through NFR-004 per spec

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + microbenchmarks.
- **Coverage + traceability**: PASS. >=85% baseline.
- **Performance/local-first**: PASS. All in-memory, no network.
- **Dockerless**: PASS.
- **Device-first**: PASS. Measures local runtime, no cloud telemetry.

## Project Structure

### Source Code

```
apps/runtime/src/diagnostics/
├── metrics.ts          # Metric registration, ring buffer management, sample recording
├── percentiles.ts      # Rolling percentile computation (p50/p95/p99/min/max/count)
├── slo.ts              # SLO threshold definitions, violation detection, rate limiting
├── hooks.ts            # markStart/markEnd API, monotonic clock wrapper, zero-alloc hot path
├── samplers.ts         # Memory sampler, frame timing sampler (interval-based)
├── query.ts            # Metrics query API (current stats for any named metric)
└── types.ts            # Metric, Sample, SLODefinition, PercentileBucket types
```

### Planning Artifacts

```
kitty-specs/006-performance-baseline-and-instrumentation/
├── spec.md
├── plan.md
└── tasks.md
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Zero-allocation hot-path hooks | Terminal input path is latency-critical; any GC pause from allocations adds jitter | Standard object creation per measurement adds allocation pressure on every keystroke |
| Rate-limited SLO violation events | Sustained degradation would flood the bus with violation events | Unbounded emission creates event storms that worsen the degradation |
| Rolling percentile over ring buffer | Fixed-window percentiles miss transient spikes; rolling gives continuous visibility | Simple averages hide tail latency; fixed windows create blind spots at boundaries |

## Quality Gate Enforcement

- Line coverage >= 85%; percentile computation and SLO detection target >= 95%.
- FR-to-test traceability: every FR-00x maps to at least one named test.
- Fail closed on lint, type-check, and test gate violations.
- Microbenchmark gate: per-measurement overhead < 0.1ms p99.
- SLO violation integration test: artificially breach thresholds, confirm bus event within rate limit.
- Memory overhead test: 10k samples x N metrics stays under 10 MB.
