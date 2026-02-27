---
work_package_id: WP01
title: PTY Spawn, State Machine, and Process Registry
lane: "doing"
dependencies: []
base_branch: main
base_commit: bcb09e51cafe8055e555a1cac68f58b198516926
created_at: '2026-02-27T12:22:51.413954+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 - Core PTY Infrastructure
assignee: ''
agent: claude-wp01-007
shell_pid: "74732"
review_status: has_feedback
reviewed_by: Koosha Paridehpour
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP01 - PTY Spawn, State Machine, and Process Registry

## Objectives & Success Criteria

- Build the foundational PTY state machine that governs all lifecycle transitions.
- Deliver an in-memory process registry mapping PTY IDs to lane, session, and terminal metadata.
- Spawn PTY processes via Bun.spawn with correct environment, dimensions, and shell config.
- Detect and reconcile orphaned PTY processes on startup.

Success criteria:
- PTY state transitions are deterministic and reject invalid transitions with diagnostic errors.
- Registry supports efficient lookup by PTY ID, lane ID, and session ID.
- Spawned PTYs produce functional file descriptors with bidirectional I/O.
- Orphaned PTY reconciliation completes within 10 seconds of startup.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/plan.md`
- Spec 002 (Local Bus) for event publishing contracts

Constraints:
- State machine must be fail-fast; no silent fallback on invalid transitions.
- Registry must not leak PTY entries on abnormal process exit.
- Spawn must work on both macOS and Linux with POSIX PTY support.

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Implement PTY state machine with validated transitions

- Purpose: govern all PTY lifecycle behavior through a strict, deterministic state machine.
- Steps:
  1. Define the PTY state enum: `idle`, `spawning`, `active`, `throttled`, `errored`, `stopped`.
  2. Define the transition table as a map of `(currentState, event) -> nextState`. Valid transitions:
     - `idle -> spawning` (on spawn request)
     - `spawning -> active` (on successful spawn)
     - `spawning -> errored` (on spawn failure)
     - `active -> throttled` (on idle timeout)
     - `active -> errored` (on unexpected exit or crash)
     - `active -> stopped` (on graceful terminate)
     - `throttled -> active` (on output resume)
     - `throttled -> stopped` (on terminate)
     - `errored -> stopped` (on cleanup)
  3. Implement `transition(currentState: PtyState, event: PtyEvent): PtyState` that throws `InvalidTransitionError` with full diagnostic context (current state, attempted event, PTY ID) for any transition not in the table.
  4. Implement `PtyLifecycle` class or record holding current state, transition history (last N transitions for debugging), and timestamps.
  5. Export types: `PtyState`, `PtyEvent`, `PtyLifecycle`, `InvalidTransitionError`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/state_machine.ts`
- Validation checklist:
  - [ ] Every state has at least one outgoing transition.
  - [ ] `stopped` is terminal; no outgoing transitions.
  - [ ] Invalid transitions throw with PTY ID, current state, and attempted event.
  - [ ] Transition history captures at least the last 10 transitions per PTY.
- Edge cases:
  - Attempting to spawn an already-active PTY must throw.
  - Rapid state changes (e.g., spawn then immediate terminate) must serialize correctly.
  - State machine must be pure (no side effects); side effects happen in callers.

### Subtask T002 - Implement in-memory process registry keyed by PTY ID

- Purpose: maintain the authoritative mapping from PTY instances to their owning lane, session, and terminal.
- Steps:
  1. Define `PtyRecord` interface containing: `ptyId`, `laneId`, `sessionId`, `terminalId`, `pid` (child process ID), `state` (current PtyState), `dimensions` (cols, rows), `createdAt`, `updatedAt`, `env` (environment snapshot).
  2. Implement `PtyRegistry` class with:
     - `register(record: PtyRecord): void` -- adds a new PTY record; throws if `ptyId` already exists.
     - `get(ptyId: string): PtyRecord | undefined` -- lookup by PTY ID.
     - `getByLane(laneId: string): PtyRecord[]` -- all PTYs for a lane.
     - `getBySession(sessionId: string): PtyRecord[]` -- all PTYs for a session.
     - `update(ptyId: string, patch: Partial<PtyRecord>): void` -- partial update with `updatedAt` bump.
     - `remove(ptyId: string): void` -- removes from registry.
     - `list(): PtyRecord[]` -- all active records.
     - `count(): number` -- total count for capacity checks.
  3. Back the registry with a `Map<string, PtyRecord>` for O(1) ID lookups.
  4. Add secondary indexes (Maps) for lane and session lookups to avoid full scans.
  5. Enforce maximum capacity (configurable, default 300 per NFR-007-003) and reject registrations beyond it with a clear error.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/registry.ts`
- Validation checklist:
  - [ ] Duplicate PTY ID registration throws.
  - [ ] Secondary indexes stay consistent after register/update/remove.
  - [ ] Capacity limit is enforced and configurable.
  - [ ] `remove` cleans up all indexes, not just the primary map.
- Edge cases:
  - Concurrent register/remove for the same PTY ID (serialize with per-ID locking or single-threaded guarantee).
  - Registry after bulk removal must have zero leaked secondary index entries.

### Subtask T003 - Implement PTY spawn via Bun.spawn

- Purpose: create functional PTY processes with bidirectional I/O bound to the registry.
- Steps:
  1. Define `SpawnOptions` interface: `shell` (path, default `/bin/bash`), `cwd` (working directory), `env` (environment variables), `cols` (default 80), `rows` (default 24), `laneId`, `sessionId`, `terminalId`.
  2. Implement `spawnPty(options: SpawnOptions): Promise<PtyRecord>` that:
     a. Generates a new PTY ID using the ID standard (spec 005 pattern or UUID v4).
     b. Transitions state from `idle` to `spawning`.
     c. Calls `Bun.spawn` with the shell, cwd, env, and PTY mode (set `stdin: "pipe"`, `stdout: "pipe"`, `stderr: "pipe"` or use Bun's PTY support).
     d. Captures the child process PID and file descriptors.
     e. Sets initial PTY dimensions using `ioctl` (TIOCSWINSZ) or Bun's resize API.
     f. Registers the PTY in the registry.
     g. Transitions state to `active`.
     h. Returns the `PtyRecord`.
  3. Handle spawn failures: transition to `errored`, publish diagnostic, do not register incomplete records.
  4. Measure and log spawn latency (spawn request to `active` state) for NFR-007-001 compliance.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/spawn.ts`
- Validation checklist:
  - [ ] Spawned PTY has a valid PID > 0.
  - [ ] File descriptors are functional (write input, read output).
  - [ ] Spawn failure transitions to `errored`, not `active`.
  - [ ] Spawn latency is measured and available for metrics.
  - [ ] Environment variables are inherited from options, not leaked from host.
- Edge cases:
  - Shell binary not found: must transition to `errored` with clear diagnostic.
  - Resource exhaustion (too many open files): must not leave partial state in registry.
  - Rapid sequential spawns must not race on registry registration.

### Subtask T004 - Wire public API surface

- Purpose: expose a clean, typed public API for PTY operations used by upstream consumers (specs 008, 009).
- Steps:
  1. Create `apps/runtime/src/pty/index.ts` that re-exports:
     - `PtyManager` class (or factory function) that wraps state machine, registry, and spawn.
     - Types: `PtyState`, `PtyEvent`, `PtyRecord`, `SpawnOptions`, `PtyLifecycle`.
  2. `PtyManager` methods:
     - `spawn(options: SpawnOptions): Promise<PtyRecord>` -- delegates to spawn.ts.
     - `get(ptyId: string): PtyRecord | undefined` -- delegates to registry.
     - `getByLane(laneId: string): PtyRecord[]` -- delegates to registry.
     - `terminate(ptyId: string): Promise<void>` -- placeholder for WP02.
     - `resize(ptyId: string, cols: number, rows: number): void` -- placeholder for WP02.
     - `writeInput(ptyId: string, data: Uint8Array): void` -- placeholder for WP02.
  3. Ensure WP02 placeholders throw `NotImplementedError` until WP02 fills them in.
  4. Document the API with JSDoc comments including parameter descriptions and error conditions.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/index.ts`
- Validation checklist:
  - [ ] All public types are exported.
  - [ ] Placeholder methods throw `NotImplementedError` with clear messages.
  - [ ] API is usable from specs 008 and 009 import paths.
  - [ ] JSDoc on every public method.

### Subtask T005 - Implement orphaned PTY detection and reconciliation on startup [P]

- Purpose: detect PTY processes from previous runtime sessions that lack registry entries and clean them up.
- Steps:
  1. On startup, scan running processes for children matching the PTY shell pattern.
  2. Compare discovered PIDs against the current registry (which is empty on fresh start).
  3. For each orphaned PID:
     a. Attempt to associate with a known lane/session if metadata files exist.
     b. If association fails, send SIGTERM with the standard grace period.
     c. Log the orphan with PID, discovered signal, and outcome.
  4. Publish a reconciliation summary event to the local bus with counts: `found`, `reattached`, `terminated`.
  5. Reconciliation must complete within 10 seconds (SC-007-003).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/registry.ts` (reconciliation method on the registry)
- Validation checklist:
  - [ ] Orphaned processes are detected via process table scan.
  - [ ] SIGTERM is delivered to orphans that cannot be reattached.
  - [ ] Reconciliation summary event is published.
  - [ ] Reconciliation completes within 10 seconds.
- Edge cases:
  - No orphaned processes: reconciliation completes immediately with zero counts.
  - Orphaned process that ignores SIGTERM: escalate to SIGKILL after grace period.
  - Permission errors scanning process table: log warning, continue with partial results.

## Test Strategy

- Unit tests for state machine transition table (all valid transitions pass, all invalid throw).
- Unit tests for registry CRUD operations and secondary index consistency.
- Integration test: spawn a real PTY, verify PID and fd, verify registry entry, verify state is `active`.
- Integration test: orphan reconciliation with a synthetically spawned background process.
- Benchmark: spawn latency p95 < 500ms.

## Risks & Mitigations

- Risk: Bun.spawn PTY support varies across versions.
- Mitigation: pin Bun version, test on CI with exact version.
- Risk: registry secondary indexes drift from primary map.
- Mitigation: single update path that always updates all indexes atomically.

## Review Guidance

- Validate state machine is pure and side-effect-free.
- Validate registry enforces capacity limits.
- Validate spawn error paths do not leak registry entries.
- Confirm orphan reconciliation handles both macOS and Linux process enumeration.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T11:57:55Z – claude-wp01-007 – shell_pid=50539 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:13:53Z – claude-wp01-007 – shell_pid=50539 – lane=planned – Agent failed, relaunching
- 2026-02-27T12:20:19Z – claude-wp01-007 – shell_pid=65144 – lane=for_review – Ready for review: all 5 subtasks implemented with 32 passing tests
- 2026-02-27T12:22:11Z – claude-wp01-007 – shell_pid=65144 – lane=planned – Moved to planned
