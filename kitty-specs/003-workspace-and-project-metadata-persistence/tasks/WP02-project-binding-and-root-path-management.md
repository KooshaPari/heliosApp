---
work_package_id: WP02
title: Project Binding and Root Path Management
lane: "doing"
dependencies: [WP01]
base_branch: 003-workspace-and-project-metadata-persistence-WP01
base_commit: d1377eb047dd343dba4bde28d2d7d708398bf1e8
created_at: '2026-02-27T11:50:41.658664+00:00'
subtasks: [T006, T007, T008, T009, T010]
phase: Phase 2 - Project Integration
assignee: ''
agent: ''
shell_pid: "38049"
---

# Work Package Prompt: WP02 - Project Binding and Root Path Management

## Objectives & Success Criteria

- Implement project binding to workspaces (local directory and git clone URL).
- Validate root paths and detect stale bindings on workspace open.
- Delegate git clone to system git binary with error handling.
- Emit bus events for workspace lifecycle transitions.

Success criteria:
- Local directory binding records absolute path and validates accessibility.
- Git clone URL binding delegates to system git and records resulting path.
- Stale detection correctly flags 100% of unreachable root paths.
- Bus events fire for all workspace lifecycle transitions.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/003-workspace-and-project-metadata-persistence/plan.md`
- WP01 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`

Constraints:
- Root paths must be absolute.
- Git clone delegates to system `git` — no embedded git.
- Bus events require spec 002 local bus — stub or import.

## Subtasks & Detailed Guidance

### Subtask T006 - Implement project binding entity and types

- Purpose: define the project binding data model and binding operations.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`.
  2. Implement `bindLocalProject(workspace: Workspace, rootPath: string): Workspace` — validates rootPath is absolute and accessible, creates `ProjectBinding` with status='active', adds to workspace.projects, returns updated workspace.
  3. Implement `bindGitProject(workspace: Workspace, gitUrl: string, targetDir: string): Promise<Workspace>` — clones repo into targetDir, creates binding with rootPath=targetDir and gitUrl, returns updated workspace.
  4. Implement `unbindProject(workspace: Workspace, projectId: string): Workspace` — removes binding from workspace.projects.
  5. Generate project IDs using spec 005 format (`proj_{ulid}`) or stub.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`
- Validation checklist:
  - [ ] `bindLocalProject` rejects relative paths.
  - [ ] `bindLocalProject` rejects inaccessible paths (directory does not exist).
  - [ ] `bindGitProject` records both gitUrl and resulting rootPath.
  - [ ] `unbindProject` with nonexistent projectId throws.
- Edge cases:
  - Binding the same directory twice to one workspace — should be rejected (duplicate rootPath check).
  - Path with symlinks — resolve to real path before storing.
- Parallel: No.

### Subtask T007 - Implement root path validation and stale detection

- Purpose: detect unreachable project roots on workspace open to prevent silent failures.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`, implement `detectStaleProjects(workspace: Workspace): Promise<Workspace>`.
  2. For each project binding, check if `rootPath` exists and is accessible (using `Bun.file` or `fs.access`).
  3. If inaccessible, set `binding.status = 'stale'`.
  4. If accessible and was previously stale, set `binding.status = 'active'` (auto-heal).
  5. Return updated workspace with modified project statuses.
  6. Wire into workspace open flow: after `openWorkspace()`, run `detectStaleProjects()`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts` (wire into open)
- Validation checklist:
  - [ ] Existing directory returns status='active'.
  - [ ] Missing directory returns status='stale'.
  - [ ] Previously stale directory that reappears returns status='active'.
  - [ ] Stale detection does not block workspace open (log warning, continue).
- Edge cases:
  - Permission denied on directory — treat as stale with specific error message.
  - Network mount that is temporarily unavailable — treat as stale.
- Parallel: No.

### Subtask T008 - Implement git clone delegation

- Purpose: support project binding via git URL by delegating to system git.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`, implement `gitClone(url: string, targetDir: string): Promise<void>`.
  2. Check for `git` binary availability using `Bun.spawn(['git', '--version'])`.
  3. Execute `git clone <url> <targetDir>` using `Bun.spawn`.
  4. Capture stdout and stderr; throw on non-zero exit code with stderr content.
  5. Validate targetDir exists after clone.
  6. Add timeout (configurable, default 120 seconds) for clone operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/project.ts`
- Validation checklist:
  - [ ] Missing git binary returns actionable error message.
  - [ ] Clone failure returns stderr content in error.
  - [ ] Timeout triggers process kill and error.
  - [ ] Successful clone produces accessible targetDir.
- Edge cases:
  - Clone into existing non-empty directory — git will error; surface that error.
  - URL with authentication — system git handles credentials; we don't manage them.
- Parallel: No.

### Subtask T009 - Wire bus event emission for workspace lifecycle

- Purpose: notify other subsystems of workspace state changes via the local bus.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`, update `WorkspaceService` to accept a bus publish function (or bus instance) via constructor.
  2. After each successful CRUD operation, publish the corresponding event:
     - `create` → publish `workspace.created` with `{ workspaceId, name, rootPath }`.
     - `open` → publish `workspace.opened` with `{ workspaceId }`.
     - `close` → publish `workspace.closed` with `{ workspaceId }`.
     - `delete` → publish `workspace.deleted` with `{ workspaceId }`.
  3. Event emission is fire-and-forget; bus errors do not fail the CRUD operation.
  4. Use correlation ID from active context if available.
  5. If bus is not available (e.g., during bootstrap), log and skip event emission.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`
- Validation checklist:
  - [ ] All four lifecycle events emit with correct topic and payload.
  - [ ] Bus error does not cause CRUD operation failure.
  - [ ] Events carry workspace ID in payload.
  - [ ] Bus unavailability is handled gracefully.
- Edge cases:
  - Bus not yet initialized at startup — events are silently dropped with log.
- Parallel: No.

### Subtask T010 - Add Vitest unit tests for project binding and stale detection

- Purpose: verify project binding, validation, stale detection, and bus event emission.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/project.test.ts`.
  2. Test `bindLocalProject`: valid absolute path, rejected relative path, inaccessible path.
  3. Test `unbindProject`: successful removal, nonexistent project ID.
  4. Test `detectStaleProjects`: accessible path stays active, missing path goes stale, recovered path auto-heals.
  5. Test duplicate rootPath binding rejection.
  6. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/events.test.ts`.
  7. Test bus event emission: mock bus publish, verify events fire for create/open/close/delete.
  8. Test bus error isolation: mock bus that throws, verify CRUD still succeeds.
  9. Add FR traceability: `// FR-003`, `// FR-004`, `// FR-009`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/project.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/workspace/events.test.ts`
- Validation checklist:
  - [ ] >= 15 test cases.
  - [ ] FR traceability comments present.
  - [ ] Tests use temp directories for path validation (clean up after).
- Edge cases:
  - Test with path containing spaces and special characters.
  - Test git clone is mocked (no network in unit tests).
- Parallel: Yes (after T007 API is stable).

## Test Strategy

- Unit tests with mocked filesystem access for path validation.
- Mock bus for event emission tests.
- Mock git binary for clone tests.
- Use temp directories for real path validation edge cases.

## Risks & Mitigations

- Risk: git clone in tests requires network.
- Mitigation: mock `Bun.spawn` in unit tests; real clone in integration tests only.

## Review Guidance

- Confirm all root paths are validated as absolute before storage.
- Confirm stale detection auto-heals recovered paths.
- Confirm bus events are fire-and-forget (never fail CRUD).
- Confirm git clone has timeout protection.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
