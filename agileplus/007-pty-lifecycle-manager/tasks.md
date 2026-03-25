# Work Packages: PTY Lifecycle Manager

**Inputs**: Design documents from `/kitty-specs/007-pty-lifecycle-manager/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 001 (Control Plane), spec 002 (Local Bus)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/007-pty-lifecycle-manager/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: PTY Spawn, State Machine, and Process Registry (Priority: P0 — prerequisite to all other WPs)

**Phase**: Phase 1 - Core PTY Infrastructure
**Goal**: Deliver PTY process spawn via Bun.spawn, a strict state machine governing PTY lifecycle (idle -> spawning -> active -> throttled -> errored -> stopped), and an in-memory process registry mapping PTY IDs to lane/session/terminal metadata.
**Independent Test**: PTY processes can be spawned, state transitions are deterministic and validated, and the registry correctly maps and queries PTY instances by lane/session.
**Prompt**: `/kitty-specs/007-pty-lifecycle-manager/tasks/WP01-pty-spawn-state-machine-and-process-registry.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [x] T001 Implement PTY state machine with validated transitions in `apps/runtime/src/pty/state_machine.ts`
- [x] T002 Implement in-memory process registry keyed by PTY ID in `apps/runtime/src/pty/registry.ts`
- [x] T003 Implement PTY spawn via Bun.spawn with environment, dimensions, and shell configuration in `apps/runtime/src/pty/spawn.ts`
- [x] T004 Wire public API surface in `apps/runtime/src/pty/index.ts` exposing spawn, query, and lifecycle operations
- [x] T005 [P] Implement orphaned PTY detection and reconciliation on startup in `apps/runtime/src/pty/registry.ts`

### Implementation Notes
- State machine must enforce strict transition validation; invalid transitions must throw with diagnostic context.
- Registry must support efficient lookup by PTY ID, lane ID, and session ID.
- Spawn must capture child PID, file descriptors, and initial dimensions in the registry.

### Parallel Opportunities
- T005 can proceed after T002 registry interface is stable.

### Dependencies
- Depends on spec 002 (Local Bus) for event publishing contracts.

### Risks & Mitigations
- Risk: Bun.spawn PTY fd handling differs across macOS/Linux.
- Mitigation: abstract fd handling behind a platform adapter tested on both targets.

---

## Work Package WP02: Input, Resize, Terminate Handlers and Signal Handling (Priority: P1)

**Phase**: Phase 2 - PTY Operations
**Goal**: Deliver write-input, resize, and terminate command handlers with POSIX signal delivery (SIGTERM, SIGKILL, SIGWINCH, SIGHUP), configurable SIGTERM-to-SIGKILL escalation, and lifecycle event publishing to the local bus.
**Independent Test**: Input bytes reach the PTY child without reordering, resize triggers SIGWINCH, terminate follows the SIGTERM->SIGKILL escalation, and all transitions emit bus events.
**Prompt**: `/kitty-specs/007-pty-lifecycle-manager/tasks/WP02-input-resize-terminate-handlers-and-signal-handling.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [x] T006 Implement write-input handler delivering bytes to PTY fd in `apps/runtime/src/pty/spawn.ts` or new `apps/runtime/src/pty/io.ts`
- [x] T007 Implement resize handler sending SIGWINCH and updating PTY dimensions in `apps/runtime/src/pty/signals.ts`
- [x] T008 Implement terminate handler with configurable SIGTERM-to-SIGKILL escalation timer in `apps/runtime/src/pty/signals.ts`
- [x] T009 Implement signal delivery audit records (signal envelope) for all signal operations
- [x] T010 [P] Wire lifecycle event publishing (spawned, state-changed, output, error, stopped) to local bus in `apps/runtime/src/pty/index.ts`
- [x] T011 [P] Implement idle timeout detection transitioning PTY to `throttled` state

### Implementation Notes
- Input handler must be zero-copy where possible and never reorder bytes.
- Signal delivery must be recorded with timestamps, outcomes, and PTY context.
- SIGTERM-to-SIGKILL grace period default: 5 seconds, configurable per-PTY.

### Parallel Opportunities
- T010 and T011 can proceed after T008 terminate handler is functional.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: zombie processes when SIGTERM fails silently.
- Mitigation: zombie detection via waitpid polling after signal delivery, force cleanup path.

---

## Work Package WP03: Bounded Output Buffering, Backpressure, and Tests (Priority: P1)

**Phase**: Phase 3 - Stream Safety and Validation
**Goal**: Deliver per-PTY bounded output ring buffers with configurable caps (default 4 MB), explicit backpressure signaling when consumers fall behind, overflow telemetry, and comprehensive unit/integration tests for the entire PTY lifecycle.
**Independent Test**: High-throughput output is buffered without exceeding memory caps, backpressure signals are emitted, and all state transitions pass deterministic tests.
**Prompt**: `/kitty-specs/007-pty-lifecycle-manager/tasks/WP03-bounded-output-buffering-backpressure-and-tests.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T012 Implement per-PTY ring buffer with configurable memory cap in `apps/runtime/src/pty/buffers.ts`
- [ ] T013 Implement backpressure signaling when buffer utilization exceeds threshold
- [ ] T014 Implement overflow telemetry emitting drop count and buffer stats to local bus
- [ ] T015 [P] Add Vitest unit tests for state machine transitions, registry operations, and signal delivery in `apps/runtime/tests/unit/pty/`
- [ ] T016 [P] Add integration tests for full spawn-input-resize-output-terminate lifecycle in `apps/runtime/tests/integration/pty/`
- [ ] T017 [P] Add stress test for buffer overflow semantics under synthetic high-throughput load

### Implementation Notes
- Ring buffer must be lock-free on the hot path to avoid blocking the event loop.
- Backpressure threshold default: 75% buffer utilization.
- Overflow events must include PTY ID, lane ID, drop count, and timestamp.

### Parallel Opportunities
- T015, T016, and T017 can all proceed in parallel once WP01 and WP02 handler interfaces are stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: ring buffer implementation introduces latency on the output hot path.
- Mitigation: benchmark buffer write/read latency and enforce < 1ms p95.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within WP01, T005 can run after T002. Within WP02, T010/T011 can run after T008. Within WP03, all test subtasks (T015-T017) can run in parallel once handler interfaces are stable.
- **MVP Scope**: All three WPs are required for MVP PTY lifecycle support.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | PTY state machine with validated transitions | WP01 | P0 | No |
| T002 | In-memory process registry | WP01 | P0 | No |
| T003 | PTY spawn via Bun.spawn | WP01 | P0 | No |
| T004 | Public API surface | WP01 | P0 | No |
| T005 | Orphaned PTY detection/reconciliation | WP01 | P0 | Yes |
| T006 | Write-input handler | WP02 | P1 | No |
| T007 | Resize handler + SIGWINCH | WP02 | P1 | No |
| T008 | Terminate handler + SIGTERM/SIGKILL escalation | WP02 | P1 | No |
| T009 | Signal delivery audit records | WP02 | P1 | No |
| T010 | Lifecycle event publishing to bus | WP02 | P1 | Yes |
| T011 | Idle timeout -> throttled detection | WP02 | P1 | Yes |
| T012 | Per-PTY ring buffer | WP03 | P1 | No |
| T013 | Backpressure signaling | WP03 | P1 | No |
| T014 | Overflow telemetry | WP03 | P1 | No |
| T015 | Unit tests for state machine/registry/signals | WP03 | P1 | Yes |
| T016 | Integration tests for full PTY lifecycle | WP03 | P1 | Yes |
| T017 | Stress test for buffer overflow | WP03 | P1 | Yes |
