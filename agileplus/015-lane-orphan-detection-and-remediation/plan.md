# Implementation Plan: Lane Orphan Detection and Remediation

**Branch**: `015-lane-orphan-detection-and-remediation` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/015-lane-orphan-detection-and-remediation/spec.md`

## Summary

Deliver a periodic watchdog that detects orphaned worktrees, stale zellij sessions, and leaked PTY processes by cross-referencing filesystem/process state against the active lane and session registries. All cleanup actions require explicit user confirmation. The watchdog persists checkpoint state for crash recovery and suppresses suggestions for resources involved in active recovery operations.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Periodic watchdog with configurable detection interval.
  - Detection of orphaned worktrees, stale zellij sessions, and leaked PTY processes.
  - Resource classification by type, age, owning lane, and risk level.
  - User-confirmable remediation with no automatic cleanup.
  - Lightweight metadata snapshot before worktree cleanup for retention-period recovery.
  - Graceful process termination (SIGTERM then SIGKILL).
  - Watchdog checkpoint persistence for crash recovery.
- **Slice-2 (deferred)**:
  - Automated policy-based cleanup for resources past configurable age thresholds.
  - Integration with external monitoring/alerting systems.
  - Full worktree content backup before cleanup (beyond metadata snapshot).

## Technical Context

**Language/Version**: TypeScript (Bun runtime)
**Primary Dependencies**: Lane lifecycle (spec 008), session lifecycle (spec 009), filesystem APIs, process-table APIs, zellij CLI
**Storage**: Checkpoint file for watchdog state; metadata snapshots for pre-cleanup backups
**Testing**: Vitest with simulated orphan scenarios, fault injection for crash recovery
**Target Platform**: Local device-first desktop runtime
**Performance Goals**: Detection cycle <2s for 100 lanes, <1% CPU during idle, <1% false positive rate
**Constraints**: Never clean up without user confirmation; suppress suggestions during active recovery

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun implementation.
- **Testing posture**: PASS. Vitest with simulated crash/orphan scenarios.
- **Coverage + traceability**: PASS. FR/NFR mapped to tests; >=85% coverage baseline.
- **Performance constraints**: PASS. Detection cycle time and CPU overhead SLOs defined.
- **Architecture discipline**: PASS. Watchdog is a standalone module consuming lane/session events with clear detection and remediation interfaces.

## Project Structure

### Documentation (this feature)

```
kitty-specs/015-lane-orphan-detection-and-remediation/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/lanes/watchdog/
├── orphan_watchdog.ts         # Periodic detection loop and checkpoint
├── worktree_detector.ts       # Orphaned worktree detection
├── zellij_detector.ts         # Stale zellij session detection
├── pty_detector.ts            # Leaked PTY process detection
├── remediation.ts             # Cleanup actions with confirmation gate
├── resource_classifier.ts     # Type, age, risk classification
└── checkpoint.ts              # Watchdog state persistence
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Three separate detectors (worktree, zellij, PTY) | Each resource type requires distinct detection logic and cleanup semantics | Unified detector would conflate different resource lifecycles and risk incorrect cleanup |
| Recovery-aware suppression | Active recovery must not trigger false orphan cleanup | Without suppression, recovering lanes would be flagged as orphans during restart |

## Quality Gate Enforcement

- Enforce line coverage baseline of `>=85%` with stricter expectations on detection and classification modules.
- Enforce requirement traceability: every FR-015-* and NFR-015-* must map to at least one test.
- Fail closed on lint/type/static/security/test gate violations.
- False positive tests must verify <1% rate across 500+ detection cycles.
- Crash recovery tests must verify watchdog resumes from checkpoint after simulated crash.
- No cleanup action may execute in any test without a simulated user confirmation step.
