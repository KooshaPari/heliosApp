---
work_package_id: WP03
title: "JSON Persistence, Corruption Recovery, and Tests"
lane: "planned"
dependencies: ["WP02"]
subtasks: ["T011", "T012", "T013", "T014", "T015", "T016"]
phase: "Phase 3 - Durability"
assignee: ""
agent: ""
---

# Work Package Prompt: WP03 - JSON Persistence, Corruption Recovery, and Tests

## Objectives & Success Criteria

- Implement JSON file persistence backend for the workspace store.
- Implement snapshot-based corruption detection and recovery.
- Serialize concurrent write operations to prevent data races.
- Validate persistence round-trip, corruption recovery, and performance SLOs.

Success criteria:
- Workspaces persist across app restart with 100% fidelity.
- Corrupted JSON files trigger recovery from last known good snapshot.
- Concurrent operations produce zero data races.
- CRUD < 100ms (p95); restore < 500ms (p95) for 50 workspaces.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/003-workspace-and-project-metadata-persistence/plan.md`
- WP01/WP02 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/workspace.ts`

Constraints:
- JSON files in well-known app data directory.
- Atomic write: temp file → fsync → rename.
- Storage < 1 MB for 50 workspaces with 10 projects each.

## Subtasks & Detailed Guidance

### Subtask T011 - Implement JSON file persistence backend

- Purpose: provide durable storage that survives app restart.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`, implement `JsonWorkspaceStore` class implementing `WorkspaceStore`.
  2. Constructor takes `dataDir: string` (app data directory path).
  3. Primary file: `{dataDir}/workspaces.json`.
  4. `save(workspace)`: update in-memory map, then call `flush()`.
  5. `flush()`: serialize all workspaces to JSON, write to temp file, fsync, atomic rename to primary file.
  6. `load(): Promise<void>`: read primary file, parse JSON, populate in-memory map. Called once at startup.
  7. Handle missing file (fresh install): initialize empty map.
  8. Export factory: `createJsonStore(dataDir: string): Promise<WorkspaceStore>` (loads on creation).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`
- Validation checklist:
  - [ ] Fresh install (no file) initializes empty.
  - [ ] Save followed by load round-trips all workspace data.
  - [ ] Atomic rename prevents partial write corruption.
  - [ ] File size under 1 MB for 50 workspaces.
- Edge cases:
  - Disk full during write — temp file creation fails; handle with clear error.
  - Data directory does not exist — create it recursively.
- Parallel: No.

### Subtask T012 - Implement snapshot creation and corruption detection

- Purpose: enable recovery from corrupted primary files.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/snapshot.ts`.
  2. Implement `createSnapshot(dataDir: string, workspaces: Workspace[]): Promise<void>`:
     - Serialize to JSON.
     - Write to `{dataDir}/workspaces.snapshot.json` using atomic write pattern.
     - Include a `_checksum` field (SHA-256 of content excluding checksum field).
  3. Implement `detectCorruption(dataDir: string): Promise<{ corrupted: boolean; reason?: string }>`:
     - Attempt JSON parse of `workspaces.json`.
     - Validate schema (all required fields present).
     - Verify checksum if present.
     - Return corruption status with reason.
  4. Call `createSnapshot` after every successful `flush()` (keeps snapshot one write behind primary).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/snapshot.ts`
- Validation checklist:
  - [ ] Snapshot file is created after flush.
  - [ ] Truncated JSON detected as corrupted.
  - [ ] Empty file detected as corrupted.
  - [ ] Invalid encoding detected as corrupted.
  - [ ] Checksum mismatch detected as corrupted.
- Edge cases:
  - Snapshot file itself is corrupted — detect and log, but cannot recover (report to user).
  - Very large workspace count — snapshot creation stays under 200ms.
- Parallel: No.

### Subtask T013 - Implement recovery from last known good snapshot

- Purpose: restore workspace state when primary file is corrupted.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/snapshot.ts`, implement `recoverFromSnapshot(dataDir: string): Promise<Workspace[] | null>`.
  2. Read `workspaces.snapshot.json`.
  3. Parse and validate schema.
  4. Verify checksum.
  5. If valid, return workspace array (caller will populate store and flush to primary).
  6. If snapshot is also corrupted, return null (caller must handle total loss).
  7. Wire into `JsonWorkspaceStore.load()`:
     - On load failure, call `detectCorruption()`.
     - If corrupted, attempt `recoverFromSnapshot()`.
     - If recovery succeeds, log warning and continue with recovered data.
     - If recovery fails, log error and initialize empty (user notification required).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/snapshot.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts` (wire recovery into load)
- Validation checklist:
  - [ ] Corrupted primary + valid snapshot recovers successfully.
  - [ ] Corrupted primary + corrupted snapshot returns null.
  - [ ] Recovery logs warning with details.
  - [ ] Recovered data is immediately flushed to fix primary file.
- Edge cases:
  - Snapshot is older than primary (normal case — one write behind).
  - Both files missing (fresh install after data wipe) — initialize empty.
- Parallel: No.

### Subtask T014 - Implement concurrent operation serialization

- Purpose: prevent data races when multiple operations modify workspace state simultaneously.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`, add a write lock mechanism.
  2. Implement `acquireLock(): Promise<() => void>` using a promise-based mutex.
  3. Wrap all `save()` and `remove()` calls in the lock.
  4. `flush()` is only called while lock is held.
  5. Read operations (`getAll`, `getById`, `getByName`) do not require the lock (reads from in-memory map are safe).
  6. Lock timeout: 5 seconds. If lock is not acquired within timeout, throw error.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/workspace/store.ts`
- Validation checklist:
  - [ ] Concurrent save operations serialize correctly (no data loss).
  - [ ] Lock timeout produces clear error.
  - [ ] Read operations are not blocked by writes.
  - [ ] Lock is always released (even on error).
- Edge cases:
  - Lock holder crashes — timeout ensures eventual recovery.
  - Deeply nested operations (save triggers another save via event handler) — re-entrant lock or queue.
- Parallel: No.

### Subtask T015 - Add integration tests for persistence and recovery

- Purpose: validate end-to-end persistence, corruption recovery, and concurrent safety.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/workspace/persistence.test.ts`.
  2. Test persistence round-trip: create workspaces, flush, create new store from same directory, verify all data restored.
  3. Test corruption recovery: write corrupted JSON to primary file, load store, verify recovery from snapshot.
  4. Test total corruption: corrupt both primary and snapshot, verify empty initialization with logged error.
  5. Test concurrent operations: 10 parallel save operations, verify all succeed and final state is consistent.
  6. Test file deletion during runtime: delete workspaces.json while app is running, next flush re-creates it.
  7. Add FR traceability: `// FR-005`, `// FR-006`, `// FR-007`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/workspace/persistence.test.ts`
- Validation checklist:
  - [ ] All persistence round-trips are lossless.
  - [ ] Corruption scenarios recover or initialize cleanly.
  - [ ] Concurrent tests produce zero data races.
  - [ ] Tests use temp directories (cleaned up after).
- Edge cases:
  - Test with workspace containing Unicode characters in name and path.
  - Test with maximum workspace count (50) for storage size validation.
- Parallel: Yes (after T011-T014 are stable).

### Subtask T016 - Add performance tests

- Purpose: enforce SLO compliance for CRUD and restore operations.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/workspace/workspace-bench.ts`.
  2. Benchmark create operation: p95 < 100ms.
  3. Benchmark open/close operations: p95 < 100ms.
  4. Benchmark restore from file with 50 workspaces x 10 projects: p95 < 500ms.
  5. Benchmark flush with 50 workspaces: p95 < 200ms.
  6. Assert thresholds in benchmark output.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/workspace/workspace-bench.ts`
- Validation checklist:
  - [ ] All benchmarks produce structured output.
  - [ ] Thresholds are asserted, not just reported.
  - [ ] Benchmarks use realistic data sizes.
- Edge cases:
  - Account for CI machine slowdown (2x factor).
- Parallel: Yes (after T011 is stable).

## Test Strategy

- Integration tests use real filesystem with temp directories.
- Corruption tests inject specific corruption types: truncated, empty, invalid JSON, checksum mismatch.
- Concurrency tests use `Promise.all` with randomized delays.
- Performance benchmarks enforce SLO thresholds.

## Risks & Mitigations

- Risk: atomic rename not truly atomic on all filesystems.
- Mitigation: fsync before rename; verify post-rename read matches written content.

## Review Guidance

- Confirm atomic write pattern is used consistently.
- Confirm snapshot is created after every successful flush.
- Confirm lock is always released in finally blocks.
- Confirm corruption detection covers all known corruption types.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
