# Implementation Plan: Ghostty Renderer Backend

**Branch**: `011-ghostty-renderer-backend` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver the ghostty renderer backend at `apps/runtime/src/renderer/ghostty/` implementing the adapter interface from spec 010. Manages the ghostty process/library lifecycle within the ElectroBun window, pipes PTY output to ghostty for GPU-accelerated rendering, relays user input back to PTYs, and collects frame metrics (FPS, frame time, input latency) for SLO monitoring.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Implement renderer adapter interface (init/start/stop/switch/queryCapabilities) for ghostty.
  - Ghostty process embedding and lifecycle management within ElectroBun window surface.
  - PTY output stream piping to ghostty render loop.
  - User input passthrough from ghostty to PTY write path.
  - GPU-accelerated rendering at 60 FPS.
  - Frame metrics collection and publishing to local bus.
  - Accurate capability matrix reporting (GPU, color depth, ligatures, dimensions, input modes).
  - Crash detection and error event publishing.
- **Slice-2 (deferred)**:
  - Ghostty configuration hot-reload without restart.
  - Custom font/theme integration beyond ghostty defaults.
  - Multi-window ghostty instances.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Ghostty library/process, renderer adapter (spec 010), PTY lifecycle (spec 007), local bus (spec 002), ElectroBun window surface
**Storage**: None (stateless renderer; state owned by adapter layer)
**Testing**: Vitest for unit tests, Playwright for render verification, benchmark harness for SLO validation
**Target Platform**: macOS/Linux with GPU acceleration (integrated or discrete)
**Performance Goals**: Input-to-echo p50 < 30ms / p95 < 60ms, input-to-render p50 < 60ms / p95 < 150ms, sustained 60 FPS, < 10 MB additional memory per terminal
**Constraints**: Must conform to spec 010 interface without modification; ElectroBun provides the render surface

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun managing ghostty process.
- **Testing posture**: PASS. Vitest + Playwright + SLO benchmarks.
- **Coverage + traceability**: PASS. >= 85% baseline.
- **Performance/local-first**: PASS. GPU-accelerated, meets constitutional rendering SLOs.
- **Architecture discipline**: PASS. Implements spec 010 interface; no interface modifications.
- **Rendering SLOs**: PASS. Targets match constitution (60 FPS, sub-60ms input latency).

## Project Structure

### Documentation

```
kitty-specs/011-ghostty-renderer-backend/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/renderer/ghostty/
├── index.ts              # Backend registration and exports
├── backend.ts            # Adapter interface implementation
├── process.ts            # Ghostty process lifecycle (start/stop/crash detection)
├── surface.ts            # ElectroBun window surface binding
├── input.ts              # Input passthrough (ghostty -> PTY)
├── metrics.ts            # Frame metrics collection and publishing
└── capabilities.ts       # Ghostty capability matrix reporting
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Ghostty process management (not in-process library) | Ghostty may only be available as a separate process, not a linkable library | In-process embedding depends on unstable FFI; process model is more portable |
| Frame metrics collection pipeline | SLO monitoring is a constitutional requirement | Without metrics, rendering degradation goes undetected until user-visible |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on lifecycle and crash recovery paths.
- Enforce FR/NFR to test traceability for all 7 FRs and 4 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Benchmark SLOs on baseline hardware in CI: 60 FPS, input-to-echo < 60ms p95.
- Verify ghostty registers with renderer adapter without interface modification.
- Test: renderer switch ghostty -> rio -> ghostty preserves sessions with zero data loss.
