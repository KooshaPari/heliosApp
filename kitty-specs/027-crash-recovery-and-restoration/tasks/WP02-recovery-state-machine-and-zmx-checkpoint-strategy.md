---
work_package_id: WP02
title: Recovery State Machine and zmx Checkpoint Strategy
lane: "planned"
dependencies:
- WP01
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T005
- T006
- T007
- T008
- T009
phase: Phase 1 - State Machine and Checkpoints
assignee: ''
agent: ''
shell_pid: ''
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Recovery State Machine and zmx Checkpoint Strategy

## Objectives & Success Criteria

- Implement the recovery state machine with ordered stages: crashed -> detecting -> inventorying -> restoring -> reconciling -> live.
- Support resumable recovery: crash during recovery resumes from the last successful stage.
- Implement zmx checkpoint read/write with atomic operations guaranteeing crash-during-checkpoint safety.
- Implement checkpoint integrity validation to detect corruption before restoration.
- Deliver time-based and activity-based checkpoint interval heuristics.

Success criteria:
- State machine progresses through all stages on valid checkpoints.
- Crash during recovery resumes from last persisted stage (not from scratch).
- Atomic checkpoint writes survive SIGKILL during write (temp file cleaned, previous checkpoint intact).
- Corrupted checkpoints are detected and skipped with clear error.
- Checkpoint intervals adapt to activity level (more frequent during high activity).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/027-crash-recovery-and-restoration/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/027-crash-recovery-and-restoration/spec.md`
- WP01 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/watchdog.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/safe-mode.ts`

Constraints:
- TypeScript + Bun runtime.
- Atomic writes via write-temp + fsync + rename.
- Checkpoint storage < 50 MB for 25 terminals (NFR-027-003).
- Crash-to-live < 10s for 25 terminals (NFR-027-001).
- Checkpoint write must be atomic (NFR-027-002).
- Coverage >=85% with FR-027-002, FR-027-003, FR-027-004 traceability.

Implementation command:
- `spec-kitty implement WP02`

## Subtasks & Detailed Guidance

### Subtask T005 - Implement recovery state machine with ordered stages and persistence

- Purpose: Govern the crash-to-live recovery lifecycle with resumable stages.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/state-machine.ts`.
  2. Define `RecoveryStage` enum:
     - `CRASHED`, `DETECTING`, `INVENTORYING`, `RESTORING`, `RECONCILING`, `LIVE`.
     - Failure states: `DETECTION_FAILED`, `INVENTORY_FAILED`, `RESTORATION_FAILED`, `RECONCILIATION_FAILED`.
  3. Implement `RecoveryStateMachine` class:
     - `getCurrentStage(): RecoveryStage`.
     - `transition(to: RecoveryStage): void` -- validate transition is legal, persist new stage, emit bus event.
     - `resume(): RecoveryStage` -- read persisted stage from disk, return stage to resume from.
     - `reset(): void` -- clear persisted state (called when recovery completes successfully).
  4. Define legal transitions:
     - CRASHED -> DETECTING -> INVENTORYING -> RESTORING -> RECONCILING -> LIVE.
     - Any stage -> corresponding failure state.
     - Failure state -> retry same stage (operator-initiated).
  5. Persist current stage to filesystem:
     - File: `<data-dir>/recovery/recovery-state.json`.
     - Content: `{ stage, timestamp, attemptCount, lastError? }`.
     - Atomic write (temp + rename).
  6. On each transition, publish bus event:
     - Topic: `recovery.stage.changed`.
     - Payload: previous stage, new stage, timestamp, attempt count.
  7. Track attempt count per stage for retry limiting (max 3 retries per stage).
  8. Implement stage timeout: if a stage takes > 30s, transition to failure state.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/state-machine.ts`
- Validation:
  - State machine progresses through all stages in order.
  - Illegal transitions are rejected with clear error.
  - Stage persistence survives process crash (verified by reading after simulated crash).
  - Resume returns correct stage after crash.
  - Stage timeout transitions to failure state.
  - Bus events emitted for all transitions.
- Parallel: No.

### Subtask T006 - Implement zmx checkpoint atomic read/write

- Purpose: Provide crash-safe checkpoint persistence for terminal session state.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/checkpoint.ts`.
  2. Define `Checkpoint` type:
     - `version: number` (schema version for forward compatibility).
     - `timestamp: number` (monotonic).
     - `checksum: string` (integrity hash).
     - `sessions: CheckpointSession[]`.
  3. Define `CheckpointSession` type:
     - `sessionId: string`, `terminalId: string`, `laneId: string`.
     - `workingDirectory: string`, `environmentVariables: Record<string, string>`.
     - `scrollbackSnapshot: string` (truncated to configurable max, default 10KB per session).
     - `zelijjSessionName: string`, `shellCommand: string`.
  4. Implement `CheckpointWriter` class:
     - `write(checkpoint: Checkpoint): Promise<void>`:
       a. Serialize checkpoint to JSON.
       b. Calculate checksum over serialized content.
       c. Write serialized content + checksum to temp file (`<path>.tmp`).
       d. Call `fsync` on temp file to flush to disk.
       e. Rename temp file to final path (atomic on POSIX).
       f. Clean up any stale temp files from previous failed writes.
     - `getCheckpointPath(): string` -- returns `<data-dir>/recovery/checkpoint.json`.
  5. Implement `CheckpointReader` class:
     - `read(): Promise<Checkpoint | null>` -- read and parse checkpoint file.
     - Return null if file does not exist (first run, no checkpoint).
     - Validate checksum before returning.
     - If checksum mismatch, return null and log corruption warning.
  6. Implement checkpoint size estimation:
     - `estimateSize(sessionCount: number): number` -- estimate bytes for N sessions.
     - Warn if estimated size exceeds 50 MB threshold (NFR-027-003).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/checkpoint.ts`
- Validation:
  - Write produces valid checkpoint file with correct checksum.
  - Atomic write survives SIGKILL (temp file exists, final file intact from previous write).
  - Read validates checksum and rejects corrupted files.
  - Size estimation is within 20% of actual for 25 sessions.
  - Stale temp files are cleaned up on next write.
- Parallel: No.

### Subtask T007 - Implement checkpoint integrity validation and corruption detection

- Purpose: Ensure only valid checkpoints are used for restoration.
- Steps:
  1. In `checkpoint.ts`, implement `validateCheckpoint(checkpoint: Checkpoint): ValidationResult`:
     - Verify checksum matches content.
     - Verify schema version is supported (reject future versions with clear error).
     - Verify each session has required fields (sessionId, terminalId, workingDirectory).
     - Verify timestamp is reasonable (not in future, not older than configurable max age, default 24h).
     - Handle clock skew: allow configurable tolerance (default 5 minutes).
  2. Define `ValidationResult` type:
     - `valid: boolean`, `errors: ValidationError[]`.
     - `ValidationError`: `{ sessionId?: string, field: string, reason: string }`.
  3. Implement per-session validation:
     - Each session can be independently valid or invalid.
     - Invalid sessions are skipped during restoration with clear reporting.
     - Valid sessions proceed to restoration.
  4. Implement corruption recovery:
     - If primary checkpoint is corrupt, check for backup checkpoint (`checkpoint.backup.json`).
     - Backup is the previous checkpoint (rotated on each write).
     - If both are corrupt, report total loss for checkpointed state.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/checkpoint.ts`
- Validation:
  - Valid checkpoint passes validation.
  - Corrupted checksum is detected.
  - Future schema version is rejected.
  - Missing required fields are caught.
  - Old timestamps (with tolerance) are accepted.
  - Per-session validation allows partial recovery.
  - Backup checkpoint fallback works.
- Parallel: No.

### Subtask T008 - Implement checkpoint interval heuristics

- Purpose: Balance checkpoint frequency between data safety and performance overhead.
- Steps:
  1. In `checkpoint.ts` or new `checkpoint-scheduler.ts`, implement `CheckpointScheduler`:
     - `start(writer: CheckpointWriter, stateGetter: () => Checkpoint): void` -- begin scheduling.
     - `stop(): void` -- stop scheduling.
     - `triggerNow(): Promise<void>` -- force immediate checkpoint.
  2. Time-based interval:
     - Default: every 60 seconds.
     - Configurable via `checkpointIntervalMs`.
  3. Activity-based heuristic:
     - Track activity events (terminal input, session create/destroy, lane changes).
     - If > N activity events since last checkpoint (default N=50), trigger checkpoint.
     - Reset activity counter on each checkpoint.
  4. Backoff during high I/O:
     - If checkpoint write takes > 500ms, double the time-based interval (up to 5 minutes max).
     - If write time returns to < 100ms, restore original interval.
  5. Ensure checkpoint is taken before graceful shutdown:
     - Hook into shutdown signal handlers (SIGTERM, SIGINT).
     - Write final checkpoint synchronously (blocking shutdown until complete or 5s timeout).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/checkpoint.ts` (or new scheduler file)
- Validation:
  - Time-based interval triggers checkpoints at configured rate.
  - Activity threshold triggers checkpoint between time intervals.
  - High I/O backoff increases interval.
  - Graceful shutdown writes final checkpoint.
  - Combined time + activity produces reasonable checkpoint frequency (not too frequent, not too sparse).
- Parallel: No.

### Subtask T009 - Add unit tests for state machine, checkpoint atomicity, validation, and heuristics

- Purpose: Lock recovery state machine and checkpoint behavior before restoration pipeline.
- Steps:
  1. Add `state-machine.test.ts`:
     - Test ordered stage progression (CRASHED -> ... -> LIVE).
     - Test illegal transition rejection.
     - Test stage persistence and resume after simulated crash.
     - Test stage timeout -> failure state.
     - Test retry limiting (max 3 attempts per stage).
     - Test bus events on transitions.
  2. Add `checkpoint.test.ts`:
     - Test atomic write: write, verify file contents and checksum.
     - Test atomic write crash safety: create temp file, simulate crash (don't rename), verify previous checkpoint intact.
     - Test read with valid checkpoint -> returns data.
     - Test read with corrupted checkpoint -> returns null.
     - Test read with no checkpoint file -> returns null.
     - Test stale temp file cleanup.
     - Test size estimation accuracy.
  3. Add `checkpoint-validation.test.ts`:
     - Test valid checkpoint passes.
     - Test checksum mismatch detected.
     - Test future schema version rejected.
     - Test missing required fields caught.
     - Test old timestamp with tolerance accepted.
     - Test per-session validation (mix of valid and invalid).
     - Test backup checkpoint fallback.
  4. Add `checkpoint-scheduler.test.ts` (use fake timers):
     - Test time-based interval triggers.
     - Test activity threshold triggers.
     - Test I/O backoff increases interval.
     - Test graceful shutdown writes checkpoint.
  5. Map tests to requirements:
     - FR-027-002 (state machine): state machine tests.
     - FR-027-003 (zmx checkpoints): checkpoint tests.
     - FR-027-004 (integrity): validation tests.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/state-machine.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/checkpoint.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/checkpoint-validation.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/recovery/__tests__/checkpoint-scheduler.test.ts`
- Validation:
  - All tests pass.
  - Coverage >=85% on state-machine.ts and checkpoint.ts.
  - FR-027-002, FR-027-003, FR-027-004 each have at least one mapped test.
- Parallel: Yes (after T005-T008 are stable).

## Test Strategy

- Use fake timers for interval and timeout tests.
- Use temporary filesystem directories for checkpoint persistence tests.
- Simulate crash by writing temp file without rename, then verify recovery.
- Bus events captured via test spy.

## Risks & Mitigations

- Risk: Atomic rename not truly atomic on all filesystems.
- Mitigation: Target POSIX rename semantics (atomic on ext4, APFS, HFS+); document non-atomic FS as unsupported.
- Risk: Large scrollback snapshots exceed 50 MB limit.
- Mitigation: Truncate scrollback per session (configurable max); size estimation warns before limit.

## Review Guidance

- Confirm state machine transitions are strictly ordered with no skip paths.
- Confirm stage persistence survives process crash.
- Confirm atomic write uses temp + fsync + rename pattern.
- Confirm checkpoint validation catches all corruption scenarios.
- Confirm interval heuristics balance safety and performance.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
