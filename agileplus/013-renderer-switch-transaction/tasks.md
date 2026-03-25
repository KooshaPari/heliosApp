# Work Packages: Transactional Renderer Switching

**Inputs**: Design documents from `/kitty-specs/013-renderer-switch-transaction/`
**Prerequisites**: plan.md (required), spec.md (user stories), dependencies on specs 010, 011, 012
**Tests**: Include explicit testing work because the feature spec requires fault injection and rollback validation.
**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.
**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/013-renderer-switch-transaction/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Switch State Machine and PTY Stream Proxy (Priority: P0 — prerequisite to WP02/WP03)

**Phase**: Phase 1 - Foundation
**Goal**: Implement the switch transaction state machine (pending -> hot-swapping/restarting -> committing/rolling-back -> committed/rolled-back/failed), the renderer capability matrix query layer, and the PTY stream proxy that buffers I/O during the switch window to guarantee zero byte loss.
**Independent Test**: State machine transitions are deterministic and test-covered; PTY proxy buffers and replays without dropped bytes under simulated load.
**Prompt**: `/kitty-specs/013-renderer-switch-transaction/tasks/WP01-switch-state-machine-and-pty-stream-proxy.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Implement switch transaction state machine with full state graph and transition guards in `apps/runtime/src/renderer/switch_transaction.ts`
- [ ] T002 Implement renderer capability matrix query (hot-swap support, version constraints) in `apps/runtime/src/renderer/capability_matrix.ts`
- [ ] T003 Implement PTY stream proxy with bounded buffering, backpressure, and replay in `apps/runtime/src/renderer/pty_stream_proxy.ts`
- [ ] T004 Wire lifecycle event emission for switch-started, switch-committed, switch-rolled-back, switch-failed on the internal bus
- [ ] T005 [P] Add unit tests for state machine transitions, capability queries, and PTY proxy buffering in `apps/runtime/tests/unit/renderer/`

### Implementation Notes
- State machine must be self-contained with no external side effects during transitions.
- PTY proxy must handle sustained throughput for the full switch window (up to 8 seconds) without overflow.
- Capability matrix must consume declarations from renderer adapters (specs 010, 011, 012).

### Parallel Opportunities
- T005 can proceed after T001/T002/T003 interfaces are stable.

### Dependencies
- Depends on specs 010 (renderer adapter interface), 011 (ghostty backend), 012 (rio backend).

### Risks & Mitigations
- Risk: PTY buffer overflow during long switch windows.
- Mitigation: bounded ring buffer with explicit overflow telemetry and configurable capacity.

---

## Work Package WP02: Hot-Swap Implementation and Rollback (Priority: P1)

**Phase**: Phase 2 - Core Switching
**Goal**: Implement the hot-swap renderer transition path and automatic rollback on failure. Hot-swap atomically transitions all active terminals from source to target renderer when both support it.
**Independent Test**: Hot-swap completes under 3s with zero dropped PTY bytes; injected failures trigger rollback restoring original renderer state.
**Prompt**: `/kitty-specs/013-renderer-switch-transaction/tasks/WP02-hot-swap-implementation-and-rollback.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T006 Implement hot-swap execution path (detach source renderer, attach target renderer, replay buffered PTY) in `apps/runtime/src/renderer/hot_swap.ts`
- [ ] T007 Implement rollback logic (restore previous renderer, replay PTY buffer, recover session state) in `apps/runtime/src/renderer/rollback.ts`
- [ ] T008 Implement concurrent switch rejection (reject new switch requests while transaction is in progress)
- [ ] T009 Wire hot-swap and rollback paths into the switch transaction state machine
- [ ] T010 [P] Add integration tests for hot-swap success, hot-swap failure with rollback, and concurrent switch rejection in `apps/runtime/tests/integration/renderer/`

### Implementation Notes
- Hot-swap must be atomic across all terminals: all switch or none do.
- Rollback must restore scrollback, cursor position, environment, and working directory.
- Concurrent switch rejection must return clear error with in-progress transaction status.

### Parallel Opportunities
- T010 can proceed once T006/T007 interfaces are integrated.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: partial renderer attachment leaves some terminals on old renderer, some on new.
- Mitigation: two-phase commit pattern with pre-validation of all terminals before detaching any.

---

## Work Package WP03: Restart-With-Restore Fallback and End-to-End Tests (Priority: P1)

**Phase**: Phase 3 - Fallback and Hardening
**Goal**: Implement the restart-with-restore fallback path using zmx checkpoint data, and deliver comprehensive end-to-end tests covering all switch paths, fault injection scenarios, and SLO validation.
**Independent Test**: Restart-with-restore completes under 8s with full session recovery; all fault injection scenarios result in clean rollback or recovery; SLO timings pass at p95.
**Prompt**: `/kitty-specs/013-renderer-switch-transaction/tasks/WP03-restart-with-restore-fallback-and-tests.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T011 Implement restart-with-restore execution path (zmx checkpoint, teardown source, start target, restore from checkpoint) in `apps/runtime/src/renderer/restart_restore.ts`
- [ ] T012 Implement degraded-but-safe mode for double-failure (rollback failure) with headless PTY preservation
- [ ] T013 Implement terminal creation queueing during active switch transactions
- [ ] T014 [P] Add fault injection tests: init failure, mid-swap failure, rollback failure, PTY buffer overflow in `apps/runtime/tests/integration/renderer/`
- [ ] T015 [P] Add SLO validation tests for hot-swap (<3s), restart-with-restore (<8s), and rollback (<5s) at p95 in `apps/runtime/tests/integration/renderer/`
- [ ] T016 [P] Add Playwright end-to-end tests for full switch workflow including UI feedback in `apps/desktop/tests/e2e/renderer/`

### Implementation Notes
- zmx checkpoint must capture scrollback, cursor, env, and cwd for all active terminals.
- Degraded-but-safe mode preserves PTY streams headlessly and prompts user to restart.
- Terminal creation queue drains after transaction commits or rolls back.

### Parallel Opportunities
- T014, T015, and T016 can proceed in parallel after T011/T012/T013 are implemented.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: zmx checkpoint/restore exceeds 8s timing budget.
- Mitigation: checkpoint only active terminals (not idle ones) and parallelize restore.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can run after interface-lock milestones.
- **MVP Scope**: WP01 + WP02 (state machine, PTY proxy, hot-swap, rollback), with WP03 adding restart-with-restore fallback and comprehensive test hardening.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Switch transaction state machine | WP01 | P0 | No |
| T002 | Renderer capability matrix query | WP01 | P0 | No |
| T003 | PTY stream proxy with buffering | WP01 | P0 | No |
| T004 | Switch lifecycle event emission | WP01 | P0 | No |
| T005 | State machine and proxy unit tests | WP01 | P0 | Yes |
| T006 | Hot-swap execution path | WP02 | P1 | No |
| T007 | Rollback logic | WP02 | P1 | No |
| T008 | Concurrent switch rejection | WP02 | P1 | No |
| T009 | Wire hot-swap/rollback into state machine | WP02 | P1 | No |
| T010 | Hot-swap and rollback integration tests | WP02 | P1 | Yes |
| T011 | Restart-with-restore execution path | WP03 | P1 | No |
| T012 | Degraded-but-safe mode | WP03 | P1 | No |
| T013 | Terminal creation queueing | WP03 | P1 | No |
| T014 | Fault injection tests | WP03 | P1 | Yes |
| T015 | SLO validation tests | WP03 | P1 | Yes |
| T016 | Playwright end-to-end tests | WP03 | P1 | Yes |
