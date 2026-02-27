---
work_package_id: WP03
title: Par Task Binding and Lane Events
lane: "doing"
dependencies:
- WP01
- WP02
base_branch: 008-par-lane-orchestrator-integration-WP02
base_commit: 08b43d310314e753b278097a855b9037d117634c
created_at: '2026-02-27T12:32:57.666763+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
phase: Phase 3 - Execution Isolation
assignee: ''
agent: "claude-wp03-008"
shell_pid: "83881"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 - Par Task Binding and Lane Events

## Objectives & Success Criteria

- Bind par tasks to lanes for execution isolation and lifecycle tracking.
- Execute commands within the lane's worktree context via par.
- Detect and force-kill stale par tasks that become unresponsive.
- Publish comprehensive lane lifecycle events for all state transitions.

Success criteria:
- Par tasks are bound to lanes and track par process PIDs.
- Commands execute within the correct worktree directory.
- Stale par tasks are detected and cleaned up within configurable timeout.
- All lane lifecycle events are published with correct correlation.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/spec.md` (FR-008-003, FR-008-004)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/plan.md`
- Par CLI documentation

Constraints:
- Par is invoked via `Bun.spawn` calling the par CLI binary.
- Par task must run within the lane's worktree as its working directory.
- Stale detection timeout default: 30 seconds, configurable.
- Force-kill escalation timeout: 10 seconds after SIGTERM.

Implementation command:
- `spec-kitty implement WP03 --base WP02`

## Subtasks & Detailed Guidance

### Subtask T011 - Implement par task binding

- Purpose: associate par-managed execution contexts with lanes.
- Steps:
  1. Implement `ParBinding` interface: `{ laneId: string, parTaskId: string, pid: number, worktreePath: string, startedAt: Date, status: 'active' | 'stale' | 'terminated' }`.
  2. Implement `bindParTask(laneId: string, worktreePath: string): Promise<ParBinding>` in `apps/runtime/src/lanes/par.ts`:
     a. Generate a par task ID.
     b. Spawn par via `Bun.spawn(['par', 'task', 'create', '--cwd', worktreePath])` (adapt to actual par CLI syntax).
     c. Capture the par process PID.
     d. Monitor the par process for unexpected exit.
     e. Update the lane record with `parTaskPid`.
     f. Return the `ParBinding`.
  3. Store par bindings in a `Map<laneId, ParBinding>` for quick lookup.
  4. Wire into lane create flow: after worktree provisioning, bind par task, then transition to `ready`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/par.ts`
- Validation checklist:
  - [ ] Par process is spawned with correct cwd.
  - [ ] PID is captured and stored.
  - [ ] Lane record is updated with parTaskPid.
  - [ ] Unexpected par exit is detected and handled.
- Edge cases:
  - Par binary not found: fail with clear diagnostic, transition lane to `closed`.
  - Par spawn fails (permission error, resource limit): clean up, transition lane to `closed`.
  - Par exits immediately after spawn: detect via exit event, re-attempt or fail.

### Subtask T012 - Implement par task termination during lane cleanup

- Purpose: ensure par tasks are stopped when lanes are cleaned up.
- Steps:
  1. Implement `terminateParTask(laneId: string): Promise<void>` in `apps/runtime/src/lanes/par.ts`:
     a. Look up the par binding for the lane.
     b. Send SIGTERM to the par process.
     c. Wait up to 10 seconds for the process to exit.
     d. If not exited, send SIGKILL.
     e. Remove the par binding from the map.
     f. Update the lane record to clear `parTaskPid`.
  2. Wire into the lane cleanup flow: after PTY termination (WP02/T008) and before worktree removal.
  3. Handle the case where par has already exited: no-op termination.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/par.ts`
- Validation checklist:
  - [ ] SIGTERM sent first, SIGKILL after timeout.
  - [ ] Par binding is removed after termination.
  - [ ] Already-exited par: idempotent, no error.
  - [ ] Lane record updated to clear PID.
- Edge cases:
  - Par process is a zombie: detect and force-clean.
  - Termination called concurrently: per-lane mutex prevents races.

### Subtask T013 - Implement command execution within lane worktree context via par

- Purpose: run operator/agent commands within the isolated lane execution context.
- Steps:
  1. Implement `executeInLane(laneId: string, command: string[]): Promise<ExecResult>` in `apps/runtime/src/lanes/par.ts`:
     a. Look up the lane record and par binding.
     b. Validate lane is in `ready` or `shared` state.
     c. Transition lane to `running`.
     d. Execute `par exec --task <parTaskId> -- <command>` via `Bun.spawn`.
     e. Capture stdout, stderr, and exit code.
     f. On completion, transition lane back to `ready`.
     g. Return `ExecResult: { stdout, stderr, exitCode, duration }`.
  2. Publish `lane.command.started` and `lane.command.completed` events.
  3. Support execution timeout (configurable, default 300 seconds).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/par.ts`
- Validation checklist:
  - [ ] Command executes within the worktree directory.
  - [ ] Lane transitions to `running` during execution.
  - [ ] Lane returns to `ready` after completion.
  - [ ] Stdout/stderr/exitCode captured correctly.
  - [ ] Timeout kills the command and returns error.
- Edge cases:
  - Command fails (non-zero exit): lane returns to `ready`, not `errored`.
  - Command times out: kill the process, return timeout error, lane to `ready`.
  - Execute on `running` lane: reject (already running).
  - Execute on `closed` lane: reject with clear error.

### Subtask T014 - Implement stale par task detection and force-kill escalation [P]

- Purpose: detect par tasks that become unresponsive and clean them up.
- Steps:
  1. Implement a periodic health check (every 15 seconds) for all active par bindings.
  2. Health check: verify the par process PID is still alive via `process.kill(pid, 0)` (signal 0 to check existence).
  3. If the PID is gone but the binding still exists, mark as `terminated` and clean up.
  4. Add an optional heartbeat mechanism: if par supports heartbeat, check the last heartbeat timestamp.
  5. If no heartbeat for `staleTimeout` (default 30 seconds), mark the binding as `stale`.
  6. For stale bindings, send SIGTERM, wait 10 seconds, then SIGKILL.
  7. Publish `lane.par_task.stale` and `lane.par_task.force_killed` events.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/par.ts`
- Validation checklist:
  - [ ] Dead par processes are detected within one health check cycle.
  - [ ] Stale detection based on heartbeat timeout.
  - [ ] Force-kill escalation follows SIGTERM -> SIGKILL.
  - [ ] Events published for stale and force-killed par tasks.
- Edge cases:
  - Par process respawns with same PID (PID reuse): unlikely on modern systems but handle by verifying process creation time if possible.
  - All par tasks are healthy: health check is a no-op.
  - Health check itself takes too long: use a timeout on the check.

### Subtask T015 - Wire comprehensive lane lifecycle events for all state transitions [P]

- Purpose: ensure complete event coverage for all lane lifecycle activity.
- Steps:
  1. Audit all state transitions in the lane manager and verify each emits a bus event.
  2. Add events for par task lifecycle: `lane.par_task.bound`, `lane.par_task.terminated`, `lane.par_task.stale`, `lane.par_task.force_killed`.
  3. Add events for worktree lifecycle: `lane.worktree.provisioned`, `lane.worktree.removed`, `lane.worktree.orphan_cleaned`.
  4. Add events for command execution: `lane.command.started`, `lane.command.completed`, `lane.command.timeout`.
  5. Ensure all events include: `laneId`, `workspaceId`, `timestamp`, `correlationId`.
  6. Create an event type catalog document or TypeScript enum listing all lane event types.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/index.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/par.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/worktree.ts`
- Validation checklist:
  - [ ] Every state transition emits an event.
  - [ ] Par task lifecycle events are complete.
  - [ ] Worktree lifecycle events are complete.
  - [ ] Command lifecycle events are complete.
  - [ ] All events include required correlation fields.
- Edge cases:
  - Bus unavailable: events dropped with warning.
  - Rapid transitions: all events emitted in order.

## Test Strategy

- Unit test par binding with mock par binary.
- Unit test stale detection with mocked PIDs and timers.
- Integration test: bind par task, execute command, verify output, terminate.
- Integration test: stale detection with a par process that exits unexpectedly.
- Event catalog completeness check: verify all defined event types are actually emitted somewhere.

## Risks & Mitigations

- Risk: par CLI interface changes between versions.
- Mitigation: pin par version, abstract CLI invocation behind a thin adapter.
- Risk: stale detection false positives on busy systems.
- Mitigation: generous default timeout (30s) and configurable per-lane.

## Review Guidance

- Validate par task binding tracks PIDs correctly.
- Validate force-kill escalation follows SIGTERM -> SIGKILL pattern.
- Confirm event catalog is complete for all lifecycle paths.
- Verify command execution uses the correct worktree as cwd.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T12:32:57Z – claude-wp03-008 – shell_pid=83881 – lane=doing – Assigned agent via workflow command
