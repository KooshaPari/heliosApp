# Implementation Plan: PTY Lifecycle Manager

**Branch**: `007-pty-lifecycle-manager` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver a PTY process management layer at `apps/runtime/src/pty/` that handles spawn, resize, input/output, signal delivery, and termination through a strict state machine. Uses `Bun.spawn` for PTY creation, maintains an in-memory process registry keyed by PTY ID, and publishes all lifecycle events to the local bus. Failure isolation ensures a single PTY crash never propagates to siblings or the global runtime.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - State machine: `idle` -> `spawning` -> `active` -> `throttled` -> `errored` -> `stopped`.
  - Process registry mapping PTY ID to lane, session, and terminal metadata.
  - Spawn via `Bun.spawn`, resize (SIGWINCH), write-input, read-output, terminate (SIGTERM/SIGKILL escalation).
  - Bounded output buffers with configurable backpressure (default 4 MB per PTY).
  - Lifecycle event publishing to local bus (spec 002).
  - Orphaned PTY reconciliation on startup.
- **Slice-2 (deferred)**:
  - Persistent PTY checkpointing across host restarts.
  - Advanced flow control beyond simple backpressure.
  - PTY pooling or pre-warming optimizations.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Bun.spawn, local bus (spec 002), POSIX PTY primitives
**Storage**: In-memory process registry
**Testing**: Vitest for unit/integration, Playwright for E2E lifecycle scenarios
**Target Platform**: macOS/Linux with POSIX PTY support
**Performance Goals**: Spawn p95 < 500ms, input-to-write p50 < 5ms / p95 < 15ms, 300 concurrent PTYs within 500 MB envelope
**Constraints**: No Docker dependency, deterministic state transitions, lane-level failure isolation

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun implementation.
- **Testing posture**: PASS. Vitest + Playwright with lifecycle coverage.
- **Coverage + traceability**: PASS. >= 85% baseline, FR/NFR to test mapping.
- **Performance/local-first**: PASS. Sub-millisecond input relay, bounded memory.
- **Architecture discipline**: PASS. Clean interface for upstream consumers (008, 009).
- **Failure isolation**: PASS. Per-PTY error containment, no cross-PTY propagation.

## Project Structure

### Documentation

```
kitty-specs/007-pty-lifecycle-manager/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/pty/
├── index.ts              # Public API surface
├── state_machine.ts      # PTY state machine and transitions
├── registry.ts           # In-memory process registry
├── spawn.ts              # Bun.spawn wrapper for PTY creation
├── signals.ts            # Signal delivery (SIGTERM/SIGKILL/SIGWINCH)
└── buffers.ts            # Output buffer management and backpressure
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Configurable SIGTERM-to-SIGKILL escalation timer | Different process types need different grace periods | Fixed timer would force-kill long-running cleanup tasks prematurely |
| Idle timeout with `throttled` state | Zombie-like processes waste resources silently | Without detection, hung PTYs accumulate until system degrades |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on state machine and signal delivery modules.
- Enforce FR/NFR to test traceability for all 8 FRs and 4 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Validate lifecycle event schema against bus contract (spec 002).
- Benchmark spawn latency and input relay latency in CI on baseline hardware profile.
