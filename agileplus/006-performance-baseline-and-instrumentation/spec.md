# Feature Specification: Performance Baseline and Instrumentation

**Feature Branch**: `006-performance-baseline-and-instrumentation`
**Created**: 2026-02-27
**Status**: Draft

## Overview

Metrics, baselines, and instrumentation for heliosApp. Scope: latency measurement for critical paths (input-to-echo, input-to-render, lane create, session restore), memory profiling, frame timing, SLO definitions aligned to the constitution, and instrumentation hooks that subsystems use to report metrics. This spec defines how we measure — not what we optimize (that belongs to each subsystem's spec).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Measure Terminal Latency (Priority: P0)

As a developer, I can measure input-to-echo and input-to-render latency with sub-millisecond precision so that I can validate SLO compliance.

**Why this priority**: Terminal responsiveness is the core product promise; unmeasured SLOs are meaningless.

**Independent Test**: Run instrumented keystroke sequence, collect latency histogram, verify p50/p95 against constitution SLOs.

**Acceptance Scenarios**:

1. **Given** an active terminal pane, **When** a keystroke is sent, **Then** the instrumentation records input-to-echo latency with < 0.1ms measurement overhead.
2. **Given** collected latency samples, **When** queried, **Then** the system returns p50, p95, p99, min, max, and count.
3. **Given** latency exceeds the SLO threshold, **When** the check runs, **Then** a `perf.slo_violation` event is emitted on the bus.

---

### User Story 2 — Monitor Memory and Frame Timing (Priority: P1)

As a developer, I can monitor steady-state memory consumption and renderer frame timing to detect regressions before they reach users.

**Why this priority**: Memory leaks and frame drops are the most common performance regressions in desktop apps.

**Acceptance Scenarios**:

1. **Given** a typical workload (25 active terminals), **When** memory is sampled every 5 seconds, **Then** steady-state stays below 500 MB and samples are recorded for trend analysis.
2. **Given** an active renderer pane, **When** frame timing is sampled, **Then** the system records frames-per-second and flags any 1-second window below 55 FPS.

---

### User Story 3 — Lifecycle Operation Timing (Priority: P1)

As a developer, I can measure lane creation, session restore, and startup latency to validate operational SLOs.

**Why this priority**: Non-terminal latencies (startup, restore) define the "snappy" perception outside the typing path.

**Acceptance Scenarios**:

1. **Given** app startup, **When** the shell reaches interactive state, **Then** startup duration is recorded and compared against the < 2s SLO.
2. **Given** a session restore operation, **When** it completes, **Then** the restore duration is recorded with workspace/session context.

---

### Edge Cases

- Instrumentation must have near-zero overhead on the hot path (< 0.1ms per measurement point).
- Clock source must be monotonic (performance.now or equivalent); wall-clock is not acceptable for latency.
- Metrics buffer must be bounded; overflow drops oldest samples with a counter increment.
- SLO violation events must be rate-limited to prevent event storms under sustained degradation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide instrumentation hooks for: input-to-echo, input-to-render, lane-create, session-restore, and startup-to-interactive.
- **FR-002**: The system MUST compute rolling percentile statistics (p50, p95, p99, min, max, count) for each instrumented metric.
- **FR-003**: The system MUST define SLO thresholds per the constitution: input-to-echo p50 < 30ms / p95 < 60ms, input-to-render p50 < 60ms / p95 < 150ms, 60 FPS target, < 500 MB memory, < 2s startup.
- **FR-004**: The system MUST emit `perf.slo_violation` bus events (via spec 002) when any metric breaches its SLO threshold.
- **FR-005**: The system MUST sample memory usage at configurable intervals (default 5s) and record time-series data.
- **FR-006**: The system MUST sample renderer frame timing and flag any 1-second window below 55 FPS.
- **FR-007**: The system MUST provide a metrics query API returning current statistics for any instrumented metric.
- **FR-008**: The system MUST use monotonic clock sources for all latency measurements.
- **FR-009**: The system MUST bound the metrics buffer (configurable, default 10,000 samples per metric) and drop oldest on overflow.
- **FR-010**: The system MUST rate-limit SLO violation events to at most 1 per metric per 10-second window.

### Non-Functional Requirements

- **NFR-001**: Per-measurement instrumentation overhead MUST be < 0.1ms (p99).
- **NFR-002**: Metrics query latency MUST be < 1ms (p95) for any single metric.
- **NFR-003**: Instrumentation memory overhead MUST be < 10 MB total for all metric buffers.
- **NFR-004**: Instrumentation MUST NOT allocate heap memory on the terminal input hot path.

### Dependencies

- **Spec 002** (Local Bus): SLO violation events and metrics queries use the bus.
- **Spec 001** (Desktop Shell): Startup timing hooks integrated into shell bootstrap.

## Key Entities

- **Metric**: Named measurement point with type (latency, gauge, counter), unit, and SLO thresholds.
- **Sample**: Single measurement instance with timestamp, value, and optional context labels.
- **Percentile Bucket**: Rolling statistical aggregation (p50/p95/p99/min/max/count) computed over a sliding window.
- **SLO Definition**: Named threshold pairing a metric to constitution-defined limits.
- **SLO Violation Event**: Bus event emitted when a metric breaches its SLO, rate-limited to prevent storms.
- **Metrics Buffer**: Bounded ring buffer holding recent samples per metric.

## Success Criteria *(mandatory)*

- **SC-001**: Input-to-echo latency measurement confirms p50 < 30ms and p95 < 60ms on reference hardware under baseline load.
- **SC-002**: Input-to-render latency measurement confirms p50 < 60ms and p95 < 150ms on reference hardware.
- **SC-003**: Memory stays below 500 MB steady-state with 25 active terminals over a 30-minute soak test.
- **SC-004**: Startup-to-interactive stays below 2s in 95% of cold-start measurements.
- **SC-005**: Instrumentation overhead confirmed < 0.1ms per measurement point in microbenchmarks.
- **SC-006**: SLO violation events fire correctly when thresholds are artificially breached in integration tests.

## Assumptions

- Reference hardware: 8 GB RAM, 4-core CPU, macOS or Linux (per constitution).
- Metrics are local-only; export to external observability systems is post-MVP.
- Frame timing measurement depends on renderer subsystem exposing frame callbacks (specs 010-013).
- Baseline load profile: 25 active terminals, 8 lanes, normal interactive typing speed.
