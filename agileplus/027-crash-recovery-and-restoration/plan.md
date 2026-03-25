# Implementation Plan: Crash Recovery and Restoration

**Branch**: `027-crash-recovery-and-restoration` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/027-crash-recovery-and-restoration/spec.md`

## Summary

Deliver a crash detection, recovery state machine, and restoration pipeline for heliosApp. When critical processes terminate abnormally, the system detects the failure via watchdog heartbeats and exit codes, inventories recoverable state from zmx checkpoints and zellij sessions, restores terminals and lanes, reconciles orphans, and reports recovery outcomes with honest loss reporting. Crash loops trigger safe mode.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Crash detection via watchdog heartbeat timeout and exit code monitoring for runtime daemon, ElectroBun host, and renderer workers.
  - Recovery state machine: crashed -> detecting -> inventorying -> restoring -> reconciling -> live (with failure states).
  - zmx checkpoint strategy: time-based + activity-based intervals, atomic writes (write-ahead or atomic-rename).
  - Restoration pipeline: zellij session reattach, par lane re-inventory, PTY re-spawn from checkpoints.
  - Orphan reconciliation scan integrating spec 015 primitives.
  - Recovery banner UI with stage indicators and completion summary.
  - Crash loop detection (3 crashes in 60s) triggering safe mode.
- **Slice-2 (deferred, must remain explicit in artifacts)**:
  - Remote checkpoint sync for cross-device recovery.
  - Full process state transfer (beyond PTY/env/scrollback) via advanced zmx capabilities.
  - Automated recovery testing in CI with simulated crash scenarios.

## Technical Context

**Language/Version**: TypeScript (TS-native track, Bun runtime)
**Primary Dependencies**: Bun, zmx checkpoint library, zellij CLI, `apps/runtime/src/protocol/` bus
**Storage**: Local filesystem for zmx checkpoints (atomic writes); in-memory for recovery state machine
**Testing**: Vitest for unit tests, chaos injection (kill -9, SIGKILL) for crash recovery integration tests
**Target Platform**: Local device-first desktop runtime (reference: 8 GB RAM, 4-core CPU)
**Project Type**: Runtime reliability subsystem -- crash recovery pipeline
**Performance Goals**: Crash-to-live < 10s (p95) for 25 terminals; checkpoint storage < 50 MB; orphan reconciliation < 5s
**Constraints**: Dockerless, local filesystem only, no remote dependencies during recovery

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + chaos injection (SIGKILL, corrupt checkpoints, crash loops).
- **Coverage + traceability**: PASS. >=85% coverage; FR-027-* mapped to test cases.
- **Performance/local-first**: PASS. Recovery is fully offline; SLOs baselined against reference hardware.
- **Architecture discipline**: PASS. Recovery orchestrates existing subsystems (007, 008, 009, 015) without owning them.

## Project Structure

### Documentation (this feature)

```
kitty-specs/027-crash-recovery-and-restoration/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/recovery/
├── watchdog.ts           # Heartbeat monitor and exit code detector
├── state-machine.ts      # Recovery state machine (crashed -> live)
├── checkpoint.ts         # zmx checkpoint read/write with atomic operations
├── restoration.ts        # Zellij reattach, par re-inventory, PTY re-spawn pipeline
├── orphan-reconciler.ts  # Post-recovery orphan scan and cleanup
├── safe-mode.ts          # Crash loop detection and safe mode entry
├── banner.ts             # Recovery banner UI state and progress reporting
└── __tests__/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Full state machine for recovery stages | FR-027-002 requires ordered progression with resumable stages and failure states | Linear script cannot resume from last successful stage after crash-during-recovery |
| Atomic checkpoint writes (WAL or rename) | NFR-027-002 requires crash-during-checkpoint safety | Non-atomic writes risk checkpoint corruption, defeating the recovery purpose |

## Quality Gate Enforcement

- Enforce line coverage baseline of >=85% with stricter expectations on state machine transitions and checkpoint integrity.
- Enforce FR-to-test traceability: every FR-027-* must have at least one dedicated test.
- Chaos tests: kill runtime daemon, verify full recovery of all sessions with valid checkpoints (SC-027-001).
- Crash loop test: 3 rapid crashes must trigger safe mode within 5s (SC-027-004).
- Orphan test: zero orphan processes 30s post-recovery (SC-027-005).
- Fail closed on lint/type/static/security/test gate violations; no ignore/skip pathways.
