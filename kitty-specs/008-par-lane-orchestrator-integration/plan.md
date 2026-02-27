# Implementation Plan: Par Lane Orchestrator Integration

**Branch**: `008-par-lane-orchestrator-integration` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver lane lifecycle orchestration at `apps/runtime/src/lanes/` that provisions git worktrees, binds par tasks, and manages lanes through a state machine from creation to cleanup. Lanes are the fundamental isolation unit for parallel agent and human work. Depends on spec 005 for ID generation, spec 007 for PTY teardown during cleanup, and spec 002 for bus events.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Lane state machine: `new` -> `provisioning` -> `ready` -> `running` -> `blocked` -> `shared` -> `cleaning` -> `closed`.
  - Git worktree provisioning and cleanup per lane.
  - Par task binding and lifecycle tracking.
  - Graceful PTY termination before worktree removal (via spec 007).
  - Lane sharing for multi-agent concurrent access.
  - Orphaned lane reconciliation on startup.
  - Lifecycle event publishing to local bus.
- **Slice-2 (deferred)**:
  - Lane checkpointing and resume across host restarts.
  - Lane templates or presets for common workflows.
  - Cross-lane dependency graphs.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Git CLI (worktree ops), par CLI, local bus (spec 002), ID standards (spec 005), PTY lifecycle (spec 007)
**Storage**: In-memory lane registry with worktree paths on disk
**Testing**: Vitest for unit/integration, E2E tests with real git repos
**Target Platform**: macOS/Linux with git worktree support
**Performance Goals**: Provisioning p95 < 5s for repos < 1 GB, cleanup p95 < 10s, 50 concurrent lanes
**Constraints**: Serialized state transitions per lane, independent cross-lane operations, no orphaned worktrees after cleanup

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + real git repo integration tests.
- **Coverage + traceability**: PASS. >= 85% baseline.
- **Performance/local-first**: PASS. Local git worktrees, no cloud dependency.
- **Architecture discipline**: PASS. Clean dependency on 005, 007; clean interface for 009.
- **Failure isolation**: PASS. Lane failures isolated; worktree provisioning failures clean up partial state.

## Project Structure

### Documentation

```
kitty-specs/008-par-lane-orchestrator-integration/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/lanes/
├── index.ts              # Public API surface
├── state_machine.ts      # Lane state machine and transitions
├── registry.ts           # In-memory lane registry
├── worktree.ts           # Git worktree provisioning and cleanup
├── par.ts                # Par task binding and lifecycle
└── sharing.ts            # Multi-agent lane sharing logic
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Per-lane serialized state transitions | Prevents race conditions during concurrent lane operations | Global lock would serialize all lane ops, defeating parallel execution |
| Orphaned lane reconciliation on startup | Worktrees and par tasks can survive crashes | Without reconciliation, stale worktrees accumulate across restarts |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on worktree provisioning and cleanup paths.
- Enforce FR/NFR to test traceability for all 8 FRs and 4 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Validate lane lifecycle events against bus contract (spec 002).
- Integration test: full create-run-cleanup cycle with real git worktrees and par tasks.
- Verify zero orphaned worktrees after cleanup in all test scenarios.
