# Implementation Plan: Rio Renderer Backend

**Branch**: `012-rio-renderer-backend` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver the rio renderer backend at `apps/runtime/src/renderer/rio/` implementing the same adapter interface from spec 010 as ghostty. Rio is feature-flagged off by default, providing a secondary renderer for redundancy. On crash, rio falls back to ghostty automatically. Frame metrics use the same schema as ghostty for renderer-agnostic monitoring. When the feature flag is disabled, rio has zero runtime cost.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Implement renderer adapter interface (init/start/stop/switch/queryCapabilities) for rio.
  - Feature flag gate: off by default, reject switch requests when disabled.
  - Rio process embedding and lifecycle management within ElectroBun window surface.
  - PTY output stream piping and input passthrough (same pattern as ghostty).
  - Frame metrics collection using identical schema to ghostty (spec 011).
  - Accurate capability matrix reporting.
  - Crash detection with fallback to ghostty.
  - Zero runtime cost when feature flag is disabled.
- **Slice-2 (deferred)**:
  - Rio-specific configuration tuning beyond defaults.
  - Rio as primary renderer (currently secondary only).
  - Automated renderer selection based on hardware profiling.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Rio library/process, renderer adapter (spec 010), PTY lifecycle (spec 007), local bus (spec 002), configuration/feature flags (spec 004), ElectroBun window surface
**Storage**: None (stateless renderer)
**Testing**: Vitest for unit tests, Playwright for render verification, benchmark harness for SLO validation
**Target Platform**: macOS/Linux with GPU acceleration
**Performance Goals**: Same SLOs as ghostty: input-to-echo p50 < 30ms / p95 < 60ms, 60 FPS, < 10 MB additional memory per terminal
**Constraints**: Feature-flagged off by default; must conform to spec 010 interface without modification; crash fallback to ghostty

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun managing rio process.
- **Testing posture**: PASS. Vitest + Playwright + SLO benchmarks.
- **Coverage + traceability**: PASS. >= 85% baseline.
- **Performance/local-first**: PASS. Meets constitutional rendering SLOs when active.
- **Architecture discipline**: PASS. Same adapter interface as ghostty; no interface modifications.
- **Zero-cost flag**: PASS. Disabled flag means no process, no memory, no runtime cost.

## Project Structure

### Documentation

```
kitty-specs/012-rio-renderer-backend/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/renderer/rio/
├── index.ts              # Backend registration and feature flag check
├── backend.ts            # Adapter interface implementation
├── process.ts            # Rio process lifecycle (start/stop/crash detection/fallback)
├── surface.ts            # ElectroBun window surface binding
├── input.ts              # Input passthrough (rio -> PTY)
├── metrics.ts            # Frame metrics (same schema as ghostty)
└── capabilities.ts       # Rio capability matrix reporting
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Feature flag with zero-runtime-cost enforcement | Rio is secondary; disabled state must have no overhead | Lazy initialization alone still loads module code and allocates registrations |
| Crash fallback to ghostty | System must always have a working renderer | Leaving the system renderer-less after rio crash violates availability requirements |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on feature flag gating and fallback paths.
- Enforce FR/NFR to test traceability for all 8 FRs and 5 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Benchmark SLOs on baseline hardware in CI when rio is active.
- Verify rio registers with renderer adapter using same interface as ghostty, no modifications.
- Test: feature flag disabled results in zero rio processes and zero rio memory allocations.
- Test: rio crash triggers automatic fallback to ghostty with session preservation.
