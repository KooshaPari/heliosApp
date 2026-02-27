---
work_package_id: WP03
title: Mux Event Relay, Reattach, and Tests
lane: "doing"
dependencies:
- WP01
- WP02
base_branch: 009-zellij-mux-session-adapter-WP02
base_commit: c5a162aa67c59701df3b1258d059cff79a3e884b
created_at: '2026-02-27T12:44:15.880873+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
phase: Phase 3 - Event Integration and Validation
assignee: ''
agent: ''
shell_pid: "66570"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 - Mux Event Relay, Reattach, and Tests

## Objectives & Success Criteria

- Relay all mux-level events (session, pane, tab lifecycle) to the local bus.
- Implement session reattach with full topology recovery after runtime restart.
- Detect and reconcile orphaned zellij sessions on startup.
- Build comprehensive unit and integration tests.

Success criteria:
- 100% of pane and tab lifecycle events published with correct correlation (SC-009-002).
- Session reattach restores pane topology in 95% of restart tests (SC-009-003).
- Zero orphaned sessions after reconciliation (SC-009-004).
- Test coverage >= 85% on zellij adapter modules.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/spec.md` (FR-009-005, FR-009-006, FR-009-008)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/plan.md`

Constraints:
- Events must match spec 002 envelope format.
- Reattach must use zellij native persistence.
- Reconciliation must compare live zellij sessions against binding registry.
- Adapter must not add > 2ms data-path latency.

Implementation command:
- `spec-kitty implement WP03 --base WP02`

## Subtasks & Detailed Guidance

### Subtask T011 - Implement mux event relay to local bus

- Purpose: make all mux activity observable by the control plane and UI.
- Steps:
  1. Define all mux event types in `apps/runtime/src/integrations/zellij/events.ts`:
     - `mux.session.created`, `mux.session.reattached`, `mux.session.terminated`
     - `mux.pane.added`, `mux.pane.closed`, `mux.pane.resized`, `mux.pane.pty_bound`
     - `mux.tab.created`, `mux.tab.closed`, `mux.tab.switched`
     - `mux.pane.dimension_rejected`
  2. Each event includes: `sessionName`, `laneId`, `timestamp`, `correlationId`.
  3. Pane events additionally include: `paneId`, `ptyId`, `dimensions`.
  4. Tab events additionally include: `tabId`, `tabName`.
  5. Implement `MuxEventEmitter` class that wraps local bus `publish()`.
  6. Wire all session/pane/tab operations from WP01 and WP02 to emit through this emitter.
  7. Events are fire-and-forget; bus failures do not block mux operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/events.ts`
- Validation checklist:
  - [ ] All defined event types are emitted by at least one operation.
  - [ ] Events include correct correlation fields.
  - [ ] Bus failure does not block mux ops.
  - [ ] Events conform to spec 002 envelope format.
- Edge cases:
  - Bus unavailable: events dropped with warning.
  - Rapid pane operations: all events emitted in order.

### Subtask T012 - Implement session reattach with pane topology recovery

- Purpose: restore full session state after runtime restart.
- Steps:
  1. On startup, iterate over all zellij sessions matching `helios-lane-*` pattern via `listSessions`.
  2. For each matching session:
     a. Extract lane ID from session name.
     b. Check if lane still exists in lane registry (spec 008).
     c. If lane exists, reattach via `reattachSession`.
     d. Query zellij for the session's pane layout.
     e. Rebuild the `LayoutTopology` for the session.
     f. For each pane in the topology, attempt to re-bind PTY (if PTY still exists from spec 007 reconciliation) or spawn a new PTY.
     g. Update the binding registry.
  3. If lane does not exist, the session is orphaned (handled in T013).
  4. Publish `mux.session.reattached` event for each successful reattach.
  5. Publish `mux.session.reattach_failed` for failures with error details.
  6. Measure reattach latency per session.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/session.ts`
- Validation checklist:
  - [ ] Sessions matching naming convention are discovered.
  - [ ] Topology is rebuilt from zellij query.
  - [ ] PTY re-binding or re-spawn is attempted for each pane.
  - [ ] Reattach events published.
  - [ ] Reattach latency measured.
- Edge cases:
  - Session exists but pane layout is empty: reattach succeeds with no panes.
  - Session has more panes than expected: include all actual panes.
  - PTY re-binding fails: spawn new PTY, log warning.

### Subtask T013 - Implement orphaned session reconciliation on startup

- Purpose: clean up zellij sessions that have no matching lane.
- Steps:
  1. After reattach phase (T012), identify remaining `helios-lane-*` sessions not bound to any lane.
  2. For each orphaned session:
     a. Attempt to terminate via `terminateSession`.
     b. Log the orphan cleanup with session name and reason.
  3. Also check binding registry for entries whose sessions no longer exist:
     a. Remove stale bindings.
  4. Publish `mux.reconciliation.completed` event with counts: `{ orphanedSessions, staleBindings, cleaned }`.
  5. Complete reconciliation within 10 seconds.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/registry.ts`
- Validation checklist:
  - [ ] Orphaned sessions terminated.
  - [ ] Stale bindings removed.
  - [ ] Reconciliation summary published.
  - [ ] Completes within 10 seconds.
- Edge cases:
  - No orphans: instant completion.
  - Session termination fails: log error, continue with others.
  - Non-helios zellij sessions: ignored entirely.

### Subtask T014 - Add Vitest unit tests for zellij adapter [P]

- Purpose: verify correctness of adapter components at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/zellij/`:
     - `cli.test.ts`: test CLI wrapper with mocked `Bun.spawn`. Test version parsing, session listing, timeout handling, missing binary detection.
     - `session.test.ts`: test session create/reattach/terminate with mocked CLI. Test naming convention, duplicate detection, error handling.
     - `registry.test.ts`: test binding registry CRUD, one-to-one enforcement, orphan detection.
     - `panes.test.ts`: test pane dimension enforcement, topology updates, PTY binding logic.
     - `tabs.test.ts`: test tab lifecycle, active tab tracking.
  2. Mock `Bun.spawn` to simulate zellij CLI responses.
  3. Target >= 85% coverage on adapter modules.
  4. Tag tests with FR/NFR IDs.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/zellij/cli.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/zellij/session.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/zellij/registry.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/zellij/panes.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/zellij/tabs.test.ts`
- Validation checklist:
  - [ ] CLI wrapper tests cover all command types.
  - [ ] Session tests cover create/reattach/terminate.
  - [ ] Registry tests verify one-to-one and orphan detection.
  - [ ] Pane tests verify dimension enforcement.
  - [ ] FR/NFR traceability tags present.

### Subtask T015 - Add integration tests with real zellij [P]

- Purpose: verify adapter works with actual zellij binary.
- Steps:
  1. Create `apps/runtime/tests/integration/zellij/lifecycle.test.ts`.
  2. Prerequisites: skip tests if zellij is not installed (`checkAvailability`).
  3. Test scenarios:
     a. Create a session, verify it appears in `zellij list-sessions`, terminate, verify gone.
     b. Create a session with 2 panes, verify topology shows 2 panes, close one, verify 1 remains.
     c. Create a session with 2 tabs, switch between them, verify tab events.
     d. Create a session, verify PTY is spawned for the default pane.
  4. Clean up all helios sessions after each test.
  5. Tests complete in < 60 seconds.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/zellij/lifecycle.test.ts`
- Validation checklist:
  - [ ] All scenarios pass with real zellij.
  - [ ] No orphaned sessions after suite.
  - [ ] Tests skip gracefully if zellij not installed.
  - [ ] Complete in < 60 seconds.

### Subtask T016 - Add reattach and reconciliation integration tests [P]

- Purpose: verify reattach and reconciliation with real zellij sessions.
- Steps:
  1. Create `apps/runtime/tests/integration/zellij/reattach.test.ts`.
  2. Test scenarios:
     a. Create a session, clear the binding registry (simulate restart), run reattach, verify session is re-bound.
     b. Create a session with 3 panes, clear registry, reattach, verify topology has 3 panes.
     c. Create a session with no matching lane, run reconciliation, verify session is terminated.
     d. Add a stale binding (no matching session), run reconciliation, verify binding removed.
  3. Clean up all sessions and bindings after each test.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/zellij/reattach.test.ts`
- Validation checklist:
  - [ ] Reattach recovers session and topology.
  - [ ] Reconciliation cleans orphaned sessions.
  - [ ] Reconciliation cleans stale bindings.
  - [ ] No orphaned state after tests.

## Test Strategy

- Run `vitest run --coverage` targeting `apps/runtime/src/integrations/zellij/`.
- Enforce >= 85% line coverage.
- Integration tests require zellij binary; skip on CI if unavailable.
- All tests clean up sessions to prevent orphans.

## Risks & Mitigations

- Risk: zellij session state is partially opaque after restart.
- Mitigation: use layout query commands to reconstruct as much as possible.
- Risk: integration tests are flaky due to zellij timing.
- Mitigation: add retries with exponential backoff for session creation verification.

## Review Guidance

- Validate event relay covers all defined event types.
- Validate reattach topology recovery includes dimensions and PTY bindings.
- Confirm reconciliation handles both orphan directions.
- Verify test cleanup is thorough.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
