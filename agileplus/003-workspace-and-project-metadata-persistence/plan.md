# Implementation Plan: Workspace and Project Metadata Persistence

**Branch**: `003-workspace-and-project-metadata-persistence` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement workspace CRUD and project binding with JSON-based persistence for MVP. Covers create/open/close/delete lifecycle, project attachment (local dir or git clone), metadata persistence across restarts, corruption detection and snapshot recovery. SQLite migration is explicitly deferred to a durability phase.

## Scope Contract

- **In scope (this slice)**:
  - Workspace CRUD: create (name + root_path), open, close, delete with state machine.
  - Unique name enforcement, active-session deletion guard.
  - Project binding: local directory and git clone URL attachment with stale detection.
  - JSON file persistence in well-known app data directory.
  - Corruption detection with last-known-good snapshot recovery.
  - Bus event emission for lifecycle transitions (`workspace.created`, `workspace.opened`, `workspace.closed`, `workspace.deleted`).
  - IDs per spec 005 standards.
- **Deferred**:
  - SQLite durability backend (future slice, migration must be non-destructive).
  - Workspace sync/sharing across devices.
  - Workspace-specific setting overrides.
  - UI surfaces (owned by spec 001).

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Bun, spec 002 (bus events), spec 005 (ID generation)
**Storage**: JSON files in app data directory (MVP); SQLite planned for durability phase
**Testing**: Vitest for unit/integration, Playwright for E2E lifecycle smoke
**Target Platform**: Local device-first desktop runtime
**Constraints**: Dockerless, < 100ms p95 CRUD ops, < 500ms restore on startup for 50 workspaces, serialized concurrent ops
**Performance Goals**: NFR-001 through NFR-004 per spec

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + Playwright.
- **Coverage + traceability**: PASS. >=85% baseline.
- **Performance/local-first**: PASS. All persistence is local JSON; no cloud dependency.
- **Dockerless**: PASS.
- **Device-first**: PASS. Filesystem-backed, no network required.

## Project Structure

### Source Code

```
apps/runtime/src/workspace/
├── workspace.ts        # Workspace entity, state machine, CRUD operations
├── project.ts          # Project binding, stale detection, git clone delegation
├── store.ts            # Persistence abstraction (JSON impl, SQLite interface stub)
├── snapshot.ts         # Snapshot creation, corruption detection, recovery
└── types.ts            # Workspace, ProjectBinding, WorkspaceState types
```

### Planning Artifacts

```
kitty-specs/003-workspace-and-project-metadata-persistence/
├── spec.md
├── plan.md
└── tasks.md
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Snapshot-based corruption recovery | Metadata loss on corrupted JSON is unacceptable for user trust | Simple "overwrite on error" loses all workspace state silently |
| Store abstraction over JSON | SQLite migration is planned; clean interface now avoids rewrite later | Direct JSON I/O without abstraction creates migration debt |

## Quality Gate Enforcement

- Line coverage >= 85%; store and snapshot modules target >= 95%.
- FR-to-test traceability: every FR-00x maps to at least one named test.
- Fail closed on lint, type-check, and test gate violations.
- Corruption injection tests required: truncated JSON, empty file, invalid encoding.
- Concurrent operation tests required: parallel CRUD produces zero races.
