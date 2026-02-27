# Work Packages: Workspace and Project Metadata Persistence

**Inputs**: Design documents from `/kitty-specs/003-workspace-and-project-metadata-persistence/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the feature spec requires strict CRUD consistency, corruption recovery, and concurrent operation safety.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/003-workspace-and-project-metadata-persistence/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Workspace CRUD and Store Abstraction (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Implement workspace entity, state machine (active/closed/deleted), CRUD operations, unique name enforcement, active-session deletion guard, and a store abstraction interface.
**Independent Test**: Full CRUD lifecycle passes with state consistency; duplicate names rejected; deletion blocked when sessions active.
**Prompt**: `/kitty-specs/003-workspace-and-project-metadata-persistence/tasks/WP01-workspace-crud-and-store-abstraction.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [x] T001 Define workspace and store types in `apps/runtime/src/workspace/types.ts`
- [x] T002 Implement workspace entity with state machine in `apps/runtime/src/workspace/workspace.ts`
- [x] T003 Implement store abstraction interface and in-memory implementation in `apps/runtime/src/workspace/store.ts`
- [x] T004 Implement workspace CRUD operations (create, open, close, delete) with validation in `apps/runtime/src/workspace/workspace.ts`
- [x] T005 [P] Add Vitest unit tests for workspace CRUD lifecycle in `apps/runtime/tests/unit/workspace/`

### Implementation Notes
- Workspace state transitions: `created -> active -> closed -> deleted` (with guards).
- Unique name enforcement per installation.
- Active-session deletion guard queries session registry (stub interface for now).
- IDs use spec 005 format (`ws_{ulid}`).

### Parallel Opportunities
- T005 can proceed once T004 CRUD API surface is stable.

### Dependencies
- None.

### Risks & Mitigations
- Risk: session registry dependency is not yet available.
- Mitigation: define session-count query interface; stub returns 0 for MVP testing.

---

## Work Package WP02: Project Binding and Root Path Management (Priority: P1)

**Phase**: Phase 2 - Project Integration
**Goal**: Implement project binding (local directory and git clone URL), root path validation, stale detection on workspace open, and bus event emission for lifecycle transitions.
**Independent Test**: Projects bind to workspaces; stale paths are detected; bus events fire for all lifecycle transitions.
**Prompt**: `/kitty-specs/003-workspace-and-project-metadata-persistence/tasks/WP02-project-binding-and-root-path-management.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [x] T006 Implement project binding entity and types in `apps/runtime/src/workspace/project.ts`
- [x] T007 Implement root path validation and stale detection in `apps/runtime/src/workspace/project.ts`
- [x] T008 Implement git clone delegation for URL-based project binding in `apps/runtime/src/workspace/project.ts`
- [x] T009 Wire bus event emission for workspace lifecycle transitions in `apps/runtime/src/workspace/workspace.ts`
- [x] T010 [P] Add Vitest unit tests for project binding and stale detection in `apps/runtime/tests/unit/workspace/`

### Implementation Notes
- Root paths must be absolute; relative paths rejected.
- Stale detection runs on workspace open, not continuously.
- Git clone delegates to system `git` binary.
- Bus events: `workspace.created`, `workspace.opened`, `workspace.closed`, `workspace.deleted`.

### Parallel Opportunities
- T010 can proceed after T007 validation API is stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: system git not available on all platforms.
- Mitigation: check for git binary before clone; return actionable error if missing.

---

## Work Package WP03: JSON Persistence, Corruption Recovery, and Tests (Priority: P1)

**Phase**: Phase 3 - Durability
**Goal**: Implement JSON file persistence, snapshot-based corruption recovery, concurrent operation serialization, and comprehensive integration tests.
**Independent Test**: Workspaces survive app restart; corrupted JSON triggers snapshot recovery; concurrent operations produce zero data races.
**Prompt**: `/kitty-specs/003-workspace-and-project-metadata-persistence/tasks/WP03-json-persistence-corruption-recovery-and-tests.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [x] T011 Implement JSON file persistence backend for the store abstraction in `apps/runtime/src/workspace/store.ts`
- [x] T012 Implement snapshot creation and corruption detection in `apps/runtime/src/workspace/snapshot.ts`
- [x] T013 Implement recovery from last known good snapshot in `apps/runtime/src/workspace/snapshot.ts`
- [x] T014 Implement concurrent operation serialization (write lock) in `apps/runtime/src/workspace/store.ts`
- [x] T015 [P] Add integration tests for persistence round-trip, corruption recovery, and concurrency in `apps/runtime/tests/integration/workspace/`
- [x] T016 [P] Add performance tests for CRUD operations (<100ms) and restore (<500ms) in `apps/runtime/tests/bench/workspace/`

### Implementation Notes
- JSON files stored in well-known app data directory (platform-specific).
- Snapshots: write new file, then atomic rename (prevents partial write corruption).
- Corruption detection: JSON parse failure, schema validation failure, checksum mismatch.
- Recovery: fall back to last known good snapshot file.
- Write lock: serialize all mutation operations to prevent race conditions.

### Parallel Opportunities
- T015 and T016 can proceed once T011/T012/T013 are stable.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: atomic rename not truly atomic on all filesystems.
- Mitigation: write to temp file, fsync, rename; verify post-rename integrity.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 is P0; WP02 and WP03 are P1 but required for restart durability.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Workspace and store types | WP01 | P0 | No |
| T002 | Workspace entity with state machine | WP01 | P0 | No |
| T003 | Store abstraction + in-memory impl | WP01 | P0 | No |
| T004 | Workspace CRUD operations | WP01 | P0 | No |
| T005 | Workspace CRUD unit tests | WP01 | P0 | Yes |
| T006 | Project binding entity and types | WP02 | P1 | No |
| T007 | Root path validation + stale detection | WP02 | P1 | No |
| T008 | Git clone delegation | WP02 | P1 | No |
| T009 | Bus event emission for lifecycle | WP02 | P1 | No |
| T010 | Project binding unit tests | WP02 | P1 | Yes |
| T011 | JSON file persistence backend | WP03 | P1 | No |
| T012 | Snapshot creation + corruption detection | WP03 | P1 | No |
| T013 | Snapshot recovery | WP03 | P1 | No |
| T014 | Concurrent operation serialization | WP03 | P1 | No |
| T015 | Persistence + recovery integration tests | WP03 | P1 | Yes |
| T016 | Performance tests for CRUD and restore | WP03 | P1 | Yes |
