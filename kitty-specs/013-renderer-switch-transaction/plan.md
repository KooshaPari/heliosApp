# Implementation Plan: Transactional Renderer Switching

**Branch**: `013-renderer-switch-transaction` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/013-renderer-switch-transaction/spec.md`

## Summary

Deliver transactional hot-swap and restart-with-restore renderer switching between ghostty and rio with automatic rollback on failure. A PTY stream proxy buffers I/O during the switch window to guarantee zero byte loss. The switch transaction state machine enforces atomicity across all active terminals and rejects concurrent switch requests.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Switch transaction state machine (pending -> hot-swapping/restarting -> committing/rolling-back -> committed/rolled-back/failed).
  - PTY stream proxy with buffering during the switch window.
  - Hot-swap path when both renderers declare support.
  - Restart-with-restore fallback using zmx checkpoint data.
  - Automatic rollback with full state recovery on any failure.
  - Lifecycle event emission for all switch phases.
- **Slice-2 (deferred)**:
  - Multi-renderer concurrent operation (running both renderers simultaneously).
  - Per-terminal renderer assignment (mixed renderer environments).
  - Switch telemetry and performance analytics dashboard.

## Technical Context

**Language/Version**: TypeScript (Bun runtime)
**Primary Dependencies**: Renderer adapters (specs 010, 011), zmx checkpoint/restore (spec 012), internal event bus (spec 001)
**Storage**: In-memory transaction state; zmx snapshots for checkpoint/restore
**Testing**: Vitest + Playwright, fault injection for rollback paths, chaos drills for mid-switch failures
**Target Platform**: Local device-first desktop runtime
**Performance Goals**: <3s hot-swap, <8s restart-with-restore, <5s rollback (all p95)
**Constraints**: Atomic all-or-nothing semantics across all active terminals; PTY buffer must not overflow during switch window

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun implementation.
- **Testing posture**: PASS. Vitest + Playwright with fault injection coverage.
- **Coverage + traceability**: PASS. FR/NFR mapped to test cases; >=85% coverage baseline.
- **Performance constraints**: PASS. SLOs defined at p95 for all switch paths.
- **Architecture discipline**: PASS. Transaction state machine is self-contained with clear renderer adapter boundaries.

## Project Structure

### Documentation (this feature)

```
kitty-specs/013-renderer-switch-transaction/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/renderer/
├── switch_transaction.ts      # Transaction state machine
├── pty_stream_proxy.ts        # PTY buffering during switch
├── capability_matrix.ts       # Renderer capability queries
├── hot_swap.ts                # Hot-swap execution path
├── restart_restore.ts         # Restart-with-restore path
└── rollback.ts                # Rollback and recovery logic
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| PTY stream proxy buffering | Zero-byte-loss guarantee requires intermediary buffering during switch | Direct PTY hand-off risks dropped bytes during renderer teardown/init overlap |
| Two-path switch (hot-swap + restart) | Renderer capability differences require both paths | Single path would either limit to capable renderers or always take the slow path |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on transaction and rollback modules.
- Enforce requirement traceability: every FR-013-* and NFR-013-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- Fault injection tests must cover: init failure, mid-swap failure, rollback failure, PTY buffer overflow, concurrent switch rejection.
- SLO validation tests must verify p95 timing for hot-swap, restart-with-restore, and rollback paths.
