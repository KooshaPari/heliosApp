---
work_package_id: WP01
title: Lane State Machine and Lifecycle Commands
lane: "for_review"
dependencies: []
base_branch: main
base_commit: e1ccdaeb4820757da27aa6af279f8f39ba6dcf4b
created_at: '2026-02-27T11:57:57.830922+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 - Lane Infrastructure
assignee: ''
agent: "claude-wp01-008"
shell_pid: "50717"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP01 - Lane State Machine and Lifecycle Commands

## Objectives & Success Criteria

- Build a strict lane state machine governing all lane lifecycle transitions.
- Deliver an in-memory lane registry with efficient lookup by lane ID, workspace ID.
- Expose lane lifecycle commands: create, list, attach, detach, cleanup.
- Support multi-agent lane sharing.
- Publish all lane state transitions to the local bus.

Success criteria:
- Lane state transitions are deterministic with per-lane serialization.
- Registry supports at least 50 concurrent lanes (NFR-008-003).
- Cleanup is idempotent.
- All transitions emit bus events with correct lane and workspace correlation.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/008-par-lane-orchestrator-integration/plan.md`
- Spec 002 (Local Bus) for event publishing, spec 005 (ID Standards) for ID generation

Constraints:
- Per-lane serialization required (NFR-008-004); cross-lane ops must remain independent.
- Duplicate cleanup requests must be idempotent.
- Lane sharing requires `shared` state with multi-agent attach tracking.

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Implement lane state machine with validated transitions

- Purpose: govern all lane lifecycle behavior through a strict, serialized state machine.
- Steps:
  1. Define `LaneState` enum: `new`, `provisioning`, `ready`, `running`, `blocked`, `shared`, `cleaning`, `closed`.
  2. Define `LaneEvent` enum: `create`, `provision_complete`, `provision_failed`, `start_running`, `block`, `unblock`, `share`, `unshare`, `request_cleanup`, `cleanup_complete`.
  3. Define the transition table:
     - `new -> provisioning` (on create)
     - `provisioning -> ready` (on provision_complete)
     - `provisioning -> closed` (on provision_failed, after partial cleanup)
     - `ready -> running` (on start_running)
     - `ready -> shared` (on share)
     - `ready -> cleaning` (on request_cleanup)
     - `running -> ready` (on command_complete)
     - `running -> blocked` (on block)
     - `running -> cleaning` (on request_cleanup)
     - `blocked -> running` (on unblock)
     - `blocked -> cleaning` (on request_cleanup)
     - `shared -> ready` (on unshare, when all agents detach)
     - `shared -> cleaning` (on request_cleanup)
     - `cleaning -> closed` (on cleanup_complete)
  4. Implement `transition(currentState, event): LaneState` that throws `InvalidLaneTransitionError` with lane ID, current state, and attempted event.
  5. Implement per-lane async mutex for serialized transitions using a `Map<string, Promise<void>>` chain pattern.
  6. Store transition history (last 20 transitions) per lane for debugging.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/state_machine.ts`
- Validation checklist:
  - [ ] Every state has at least one outgoing transition.
  - [ ] `closed` is terminal; no outgoing transitions.
  - [ ] Invalid transitions throw with full diagnostic context.
  - [ ] Per-lane mutex prevents concurrent transitions on the same lane.
  - [ ] Cross-lane transitions are independent (no global lock).
- Edge cases:
  - Cleanup requested during `provisioning`: must wait for provision to complete or fail, then clean up.
  - Duplicate cleanup requests on `cleaning` lane: idempotent, no error.
  - Rapid create-then-cleanup: must complete provisioning before cleaning.

### Subtask T002 - Implement in-memory lane registry with secondary indexes

- Purpose: maintain authoritative mapping from lanes to their metadata and resources.
- Steps:
  1. Define `LaneRecord` interface: `laneId`, `workspaceId`, `state` (LaneState), `worktreePath` (string | null), `parTaskPid` (number | null), `attachedAgents` (string[]), `baseBranch`, `createdAt`, `updatedAt`.
  2. Implement `LaneRegistry` class:
     - `register(record: LaneRecord): void` -- adds lane; throws on duplicate.
     - `get(laneId: string): LaneRecord | undefined`.
     - `getByWorkspace(workspaceId: string): LaneRecord[]`.
     - `update(laneId: string, patch: Partial<LaneRecord>): void`.
     - `remove(laneId: string): void`.
     - `list(): LaneRecord[]`.
     - `count(): number`.
  3. Secondary indexes: `Map<workspaceId, Set<laneId>>`.
  4. Enforce capacity limit of 50 lanes (NFR-008-003), configurable.
  5. Expose `getActive(): LaneRecord[]` returning non-closed lanes.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/registry.ts`
- Validation checklist:
  - [ ] Duplicate lane ID throws.
  - [ ] Secondary indexes consistent after mutations.
  - [ ] Capacity enforced.
  - [ ] `remove` cleans all indexes.
- Edge cases:
  - Remove non-existent lane: no-op or warning, not throw.
  - Update non-existent lane: throw with diagnostic.

### Subtask T003 - Implement lane lifecycle commands

- Purpose: expose the high-level API for creating, listing, attaching to, and cleaning up lanes.
- Steps:
  1. Implement `LaneManager` class in `apps/runtime/src/lanes/index.ts`:
     - `create(workspaceId: string, baseBranch: string): Promise<LaneRecord>` -- generates lane ID, registers, transitions to `provisioning`. Worktree provisioning is a placeholder for WP02.
     - `list(workspaceId?: string): LaneRecord[]` -- lists lanes, optionally filtered.
     - `attach(laneId: string, agentId: string): Promise<void>` -- adds agent to attachedAgents.
     - `detach(laneId: string, agentId: string): Promise<void>` -- removes agent; if last agent detaches from `shared` lane, transitions to `ready`.
     - `cleanup(laneId: string): Promise<void>` -- transitions to `cleaning`, placeholder for worktree/PTY/par cleanup in WP02/WP03, then transitions to `closed`.
  2. All operations acquire the per-lane mutex from T001.
  3. All operations publish events via the bus (wired in T004).
  4. Placeholder methods for WP02 (worktree) and WP03 (par) throw `NotImplementedError`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/index.ts`
- Validation checklist:
  - [ ] create returns a valid lane record in `provisioning` state.
  - [ ] cleanup is idempotent.
  - [ ] attach/detach update attachedAgents correctly.
  - [ ] Per-lane mutex is acquired for all mutations.
- Edge cases:
  - Attach to a `closed` lane: must reject.
  - Detach an agent not in attachedAgents: no-op.
  - Create when at capacity: throw with clear message.

### Subtask T004 - Wire lane lifecycle event publishing to local bus [P]

- Purpose: ensure all lane transitions are observable by the control plane and UI.
- Steps:
  1. Define event types: `lane.created`, `lane.state.changed`, `lane.shared`, `lane.cleaning`, `lane.closed`.
  2. Each event includes: `laneId`, `workspaceId`, `fromState`, `toState`, `timestamp`, `correlationId`.
  3. Hook event emission into LaneManager: every successful transition emits `lane.state.changed`.
  4. Special events: `lane.shared` when entering shared state, `lane.closed` on final cleanup.
  5. Events are fire-and-forget; bus failures do not block lane operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/index.ts`
- Validation checklist:
  - [ ] Every state transition emits an event.
  - [ ] Events include from/to state.
  - [ ] Bus failure does not block lane ops.
- Edge cases:
  - Bus unavailable at startup: events dropped with warning.

### Subtask T005 - Implement lane sharing (multi-agent concurrent access) [P]

- Purpose: allow multiple agents to work within a single lane concurrently.
- Steps:
  1. Implement `share(laneId: string): Promise<void>` that transitions lane to `shared` from `ready` or `running`.
  2. Implement `unshare(laneId: string): Promise<void>` that transitions back to `ready` when all agents detach.
  3. Track attached agents in `LaneRecord.attachedAgents`.
  4. Enforce that `shared` lanes accept multiple `attach` calls without error.
  5. Publish `lane.shared` event on entering shared state, `lane.state.changed` on leaving.
  6. Shared lanes cannot be cleaned up until all agents detach (or force-cleanup bypasses this).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/lanes/sharing.ts`
- Validation checklist:
  - [ ] Multiple agents can attach to shared lane.
  - [ ] Last agent detach returns lane to `ready`.
  - [ ] Shared event published.
  - [ ] Cleanup on shared lane with agents: reject or force-detach.
- Edge cases:
  - Share a lane already in `shared` state: idempotent.
  - Agent attaches twice: second attach is no-op.
  - Force cleanup of shared lane with active agents: detach all, then clean up.

## Test Strategy

- Unit tests for state machine transitions (all valid/invalid).
- Unit tests for registry CRUD and secondary indexes.
- Integration test: create a lane, verify state, attach agent, share, detach, cleanup.
- Concurrency test: concurrent transitions on the same lane are serialized.

## Risks & Mitigations

- Risk: per-lane mutex causes deadlock if cleanup waits on provisioning.
- Mitigation: provisioning is awaited within the same mutex chain, no nested lock acquisition.
- Risk: shared state complexity with agent tracking.
- Mitigation: simple set-based tracking; no complex coordination protocol.

## Review Guidance

- Validate per-lane serialization actually prevents concurrent transitions (test with deliberate races).
- Validate cleanup idempotency.
- Confirm event payloads include workspace and lane correlation.
- Verify sharing logic handles all agent attach/detach edge cases.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T11:57:58Z – claude-wp01-008 – shell_pid=50717 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:04:13Z – claude-wp01-008 – shell_pid=50717 – lane=for_review – Ready for review
