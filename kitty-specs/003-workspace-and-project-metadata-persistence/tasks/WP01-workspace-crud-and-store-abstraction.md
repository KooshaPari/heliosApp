---
work_package_id: WP01
title: Workspace CRUD and Store Abstraction
lane: "for_review"
dependencies: []
base_branch: main
base_commit: 138c026f17f300bb7a61f1c5868941eb28c42236
created_at: '2026-02-27T11:28:37.124825+00:00'
subtasks: [T001, T002, T003, T004, T005]
phase: Phase 1 - Foundation
assignee: ''
agent: "wp01-ws-agent"
shell_pid: "28454"
---

# Work Package Prompt: WP01 - Workspace CRUD and Store Abstraction

## Objectives & Success Criteria

- Define workspace entity types and state machine.
- Implement full CRUD lifecycle with validation and guards.
- Establish a store abstraction that supports in-memory (now) and JSON/SQLite (later) backends.
- Enforce unique workspace names and active-session deletion guards.

Success criteria:
- Workspace CRUD lifecycle completes with 100% state consistency.
- Duplicate name creation is rejected with a clear error.
- Deletion is blocked when active sessions exist.
- Store abstraction compiles against both in-memory and persistence interface.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/003-workspace-and-project-metadata-persistence/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/003-workspace-and-project-metadata-persistence/spec.md`
- Target directory: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/`

Constraints:
- CRUD operations < 100ms (p95).
- IDs use spec 005 format (`ws_{ulid}`) — import or stub.
- Keep files under 350 lines.

## Subtasks & Detailed Guidance

### Subtask T001 - Define workspace and store types

- Purpose: establish the type foundation for all workspace operations.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/types.ts`.
  2. Define `WorkspaceState` union: `'active' | 'closed' | 'deleted'`.
  3. Define `Workspace` interface: `{ id: string; name: string; rootPath: string; state: WorkspaceState; createdAt: number; updatedAt: number; projects: ProjectBinding[] }`.
  4. Define `ProjectBinding` interface: `{ id: string; workspaceId: string; rootPath: string; gitUrl?: string; status: 'active' | 'stale'; boundAt: number }`.
  5. Define `WorkspaceStore` interface with methods: `getAll(): Promise<Workspace[]>`, `getById(id: string): Promise<Workspace | undefined>`, `getByName(name: string): Promise<Workspace | undefined>`, `save(workspace: Workspace): Promise<void>`, `remove(id: string): Promise<void>`, `flush(): Promise<void>`.
  6. Define `CreateWorkspaceInput`: `{ name: string; rootPath: string }`.
  7. Export all types.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/types.ts`
- Validation checklist:
  - [ ] All types compile under `strict: true`.
  - [ ] `WorkspaceStore` is an interface, not a class (enables multiple backends).
  - [ ] `Workspace.projects` is included for co-persistence.
- Edge cases:
  - `rootPath` type is `string` but must be validated as absolute at runtime, not in type system.
- Parallel: No.

### Subtask T002 - Implement workspace entity with state machine

- Purpose: encapsulate workspace state transitions with validation guards.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`.
  2. Implement state transition functions:
     - `createWorkspace(input: CreateWorkspaceInput): Workspace` — generates ID, sets state=active, validates name non-empty, validates rootPath is absolute.
     - `openWorkspace(ws: Workspace): Workspace` — asserts state is 'closed', transitions to 'active'.
     - `closeWorkspace(ws: Workspace): Workspace` — asserts state is 'active', transitions to 'closed'.
     - `deleteWorkspace(ws: Workspace, activeSessionCount: number): Workspace` — asserts activeSessionCount === 0, transitions to 'deleted'.
  3. Each function returns a new object (immutable transitions).
  4. Throw typed errors for invalid transitions (e.g., opening a deleted workspace).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`
- Validation checklist:
  - [ ] `createWorkspace` rejects empty names.
  - [ ] `createWorkspace` rejects relative root paths.
  - [ ] `deleteWorkspace` with activeSessionCount > 0 throws.
  - [ ] Invalid state transitions throw with descriptive messages.
  - [ ] All transitions return new objects (no mutation).
- Edge cases:
  - Closing an already closed workspace — should throw, not silently succeed.
  - Root path with trailing slash — normalize consistently.
- Parallel: No.

### Subtask T003 - Implement store abstraction and in-memory backend

- Purpose: provide a persistence layer that can swap backends without changing consumers.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`, implement `InMemoryWorkspaceStore` class implementing `WorkspaceStore`.
  2. Internal storage: `Map<string, Workspace>`.
  3. `getAll()`: return all values sorted by `createdAt`.
  4. `getByName(name)`: linear scan with case-insensitive comparison.
  5. `save(workspace)`: upsert by `workspace.id`.
  6. `remove(id)`: delete from map.
  7. `flush()`: no-op for in-memory (placeholder for persistence backends).
  8. Export factory: `createInMemoryStore(): WorkspaceStore`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`
- Validation checklist:
  - [ ] `getAll` returns sorted results.
  - [ ] `getByName` is case-insensitive.
  - [ ] `save` after `remove` re-adds the workspace.
  - [ ] `flush` is callable without error.
- Edge cases:
  - `getById` with nonexistent ID returns undefined, not null.
  - `remove` with nonexistent ID is a no-op.
- Parallel: No.

### Subtask T004 - Implement workspace CRUD operations with validation

- Purpose: provide a service layer that combines entity logic, store, and name uniqueness.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`, implement `WorkspaceService` class.
  2. Constructor takes `WorkspaceStore` and an optional `sessionCountQuery: (workspaceId: string) => Promise<number>` (stub default returns 0).
  3. `create(input: CreateWorkspaceInput): Promise<Workspace>`:
     - Check name uniqueness via `store.getByName()`.
     - Call `createWorkspace()` entity function.
     - `store.save()`.
     - Return workspace.
  4. `open(id: string): Promise<Workspace>`:
     - Fetch from store, call `openWorkspace()`, save.
  5. `close(id: string): Promise<Workspace>`:
     - Fetch from store, call `closeWorkspace()`, save.
  6. `delete(id: string): Promise<void>`:
     - Fetch from store, query session count, call `deleteWorkspace()`, `store.remove()`.
  7. `list(): Promise<Workspace[]>`: delegate to `store.getAll()`.
  8. `get(id: string): Promise<Workspace | undefined>`: delegate to `store.getById()`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`
- Validation checklist:
  - [ ] `create` with duplicate name throws.
  - [ ] `open` with nonexistent ID throws.
  - [ ] `delete` with active sessions throws with "close sessions first" message.
  - [ ] All operations update `updatedAt` timestamp.
- Edge cases:
  - Concurrent create with same name — first wins, second gets uniqueness error.
  - Delete then create with same name — allowed (name is freed on delete).
- Parallel: No.

### Subtask T005 - Add Vitest unit tests for workspace CRUD lifecycle

- Purpose: lock CRUD behavior and guard against regressions.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/workspace.test.ts`.
  2. Test full lifecycle: create → open → close → open → close → delete.
  3. Test duplicate name rejection.
  4. Test deletion guard with active sessions (mock sessionCountQuery returning 1).
  5. Test invalid state transitions: open a deleted workspace, delete an active workspace with sessions.
  6. Test root path validation: relative path rejected, absolute path accepted.
  7. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/store.test.ts`.
  8. Test in-memory store: save, getAll, getById, getByName, remove.
  9. Test case-insensitive name lookup.
  10. Add FR traceability: `// FR-001`, `// FR-002`, `// FR-008`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/workspace.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/store.test.ts`
- Validation checklist:
  - [ ] >= 15 test cases.
  - [ ] FR traceability comments present.
  - [ ] Tests run in < 3 seconds.
- Edge cases:
  - Test with empty workspace name, whitespace-only name, very long name (1000 chars).
- Parallel: Yes (after T004 API is stable).

## Test Strategy

- Unit tests via Vitest covering all CRUD paths and error conditions.
- Mock session count query for deletion guard testing.
- State machine tested exhaustively (all valid and invalid transitions).

## Risks & Mitigations

- Risk: session registry not available for deletion guard.
- Mitigation: injectable query function with stub default; integration test wires real registry later.

## Review Guidance

- Confirm state machine transitions are exhaustive and guarded.
- Confirm name uniqueness is case-insensitive.
- Confirm store interface is backend-agnostic.
- Confirm no mutation of workspace objects.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:28:37Z – wp01-ws-agent – shell_pid=28454 – lane=doing – Assigned agent via workflow command
- 2026-02-27T11:31:48Z – wp01-ws-agent – shell_pid=28454 – lane=for_review – Ready for review: Workspace CRUD lifecycle with types, state machine, in-memory store, service layer, and 32 passing unit tests
