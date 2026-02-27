---
work_package_id: WP02
title: Input, Resize, Terminate Handlers and Signal Handling
lane: "for_review"
dependencies:
- WP01
base_branch: 007-pty-lifecycle-manager-WP01
base_commit: c387c28ded3abd4e4eb250b44bb2d71e2657335e
created_at: '2026-02-27T12:32:12.283964+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
- T011
phase: Phase 2 - PTY Operations
assignee: ''
agent: "claude-wp02-007"
shell_pid: "81904"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Input, Resize, Terminate Handlers and Signal Handling

## Objectives & Success Criteria

- Deliver write-input, resize, and terminate command handlers for PTY instances.
- Implement POSIX signal delivery (SIGTERM, SIGKILL, SIGWINCH, SIGHUP) with auditable records.
- Add configurable SIGTERM-to-SIGKILL escalation and idle timeout detection.
- Publish all PTY lifecycle events to the local bus.

Success criteria:
- Input bytes reach the child process without reordering or loss.
- Resize triggers SIGWINCH and updates stored dimensions.
- Terminate follows SIGTERM->SIGKILL escalation with configurable grace period.
- All state transitions and signal deliveries emit bus events with correct correlation IDs.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/spec.md` (FR-007-003, FR-007-004, FR-007-007)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/plan.md`
- Spec 002 (Local Bus) event publishing contracts

Constraints:
- Input handler must not buffer or reorder; direct write to PTY fd.
- Signal delivery must be recorded for auditability.
- SIGTERM-to-SIGKILL default grace: 5 seconds, configurable per-PTY.
- NFR-007-002: input-to-PTY-write p50 < 5ms, p95 < 15ms.

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement write-input handler delivering bytes to PTY fd

- Purpose: relay operator/agent input to the PTY child process with minimal latency.
- Steps:
  1. Implement `writeInput(ptyId: string, data: Uint8Array): void` in a dedicated I/O module or extend `spawn.ts`.
  2. Validate that the PTY is in `active` or `throttled` state before writing; reject writes to PTYs in other states with `InvalidStateError`.
  3. Write directly to the PTY stdin file descriptor. Use `Bun.write` or the process stdin stream.
  4. Do NOT buffer input; write synchronously or with minimal async overhead.
  5. Measure input-to-write latency at the handler boundary for NFR-007-002.
  6. If the write fails (broken pipe, fd closed), transition the PTY to `errored` and publish a diagnostic event.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/spawn.ts` (or new `apps/runtime/src/pty/io.ts`)
- Validation checklist:
  - [ ] Input bytes are written without reordering.
  - [ ] Writes to non-active PTYs are rejected with clear error.
  - [ ] Broken pipe triggers `errored` transition.
  - [ ] Latency measurement is captured per write.
- Edge cases:
  - Writing to a PTY that has just exited but state has not yet updated: must handle EPIPE gracefully.
  - Zero-length writes: must be no-ops, not errors.
  - Very large writes (> 64KB): must succeed or fail atomically, not partially.

### Subtask T007 - Implement resize handler sending SIGWINCH and updating PTY dimensions

- Purpose: synchronize the PTY dimensions with the terminal viewport.
- Steps:
  1. Implement `resize(ptyId: string, cols: number, rows: number): void` in `signals.ts`.
  2. Validate dimensions: `cols >= 1`, `rows >= 1`, both <= 10000 (sanity cap). Reject invalid dimensions with `InvalidDimensionsError`.
  3. Update the PTY's stored dimensions in the registry via `registry.update()`.
  4. Set the PTY window size using `ioctl(fd, TIOCSWINSZ, winsize)` or Bun's PTY resize API.
  5. Deliver SIGWINCH to the child process group.
  6. Publish a `pty.resized` event with PTY ID, lane ID, old dimensions, new dimensions.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/signals.ts`
- Validation checklist:
  - [ ] Dimensions are validated before ioctl call.
  - [ ] Registry dimensions are updated atomically with the ioctl.
  - [ ] SIGWINCH is delivered to the child process.
  - [ ] Resize event is published with before/after dimensions.
- Edge cases:
  - Resize on a PTY in `errored` state: must reject, not crash.
  - Rapid sequential resizes: last-write-wins semantics; no queueing needed.
  - Child process that has already exited: ioctl may fail; handle gracefully.

### Subtask T008 - Implement terminate handler with SIGTERM-to-SIGKILL escalation

- Purpose: gracefully shut down PTY processes with configurable escalation.
- Steps:
  1. Implement `terminate(ptyId: string, options?: { gracePeriodMs?: number }): Promise<void>` in `signals.ts`.
  2. Default grace period: 5000ms (FR-007-007), overridable per-call.
  3. Termination sequence:
     a. Send SIGTERM to the child process group.
     b. Start a timer for the grace period.
     c. Monitor the child process for exit (via `waitpid` polling or Bun's process exit event).
     d. If the process exits within the grace period, transition to `stopped`.
     e. If the grace period expires, send SIGKILL.
     f. Wait for the SIGKILL to take effect (up to 1 second additional).
     g. Transition to `stopped` and clean up registry entry.
  4. Publish `pty.terminating` on SIGTERM, `pty.force_killed` on SIGKILL escalation, and `pty.stopped` on final cleanup.
  5. Close file descriptors after the process exits.
  6. Remove the PTY from the registry.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/signals.ts`
- Validation checklist:
  - [ ] SIGTERM is sent first, always.
  - [ ] SIGKILL is sent only after grace period expiry.
  - [ ] File descriptors are closed after process exit.
  - [ ] Registry entry is removed after cleanup.
  - [ ] Termination events are published in order.
- Edge cases:
  - Terminate called on an already-stopped PTY: must be idempotent, no error.
  - Terminate called on a PTY in `spawning` state: must wait for spawn to complete or fail, then terminate.
  - Process that exits between SIGTERM send and waitpid: handle the race gracefully.
  - Zombie processes that cannot be waited: detect and force-clean registry.

### Subtask T009 - Implement signal delivery audit records

- Purpose: maintain auditable records of every signal delivered to PTY processes.
- Steps:
  1. Define `SignalEnvelope` type: `{ ptyId, signal, timestamp, outcome: 'delivered' | 'failed' | 'escalated', pid, error?: string }`.
  2. After every signal delivery (SIGTERM, SIGKILL, SIGWINCH, SIGHUP), create a `SignalEnvelope` record.
  3. Publish the envelope to the local bus as a `pty.signal.delivered` event.
  4. Store the last N signal envelopes (configurable, default 50) per PTY in the lifecycle record for debugging.
  5. Include the signal envelope in any error events where signal delivery fails.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/signals.ts`
- Validation checklist:
  - [ ] Every signal delivery produces an envelope.
  - [ ] Failed deliveries have the `failed` outcome with error details.
  - [ ] Envelopes are published to the bus.
  - [ ] Per-PTY signal history is bounded.
- Edge cases:
  - Signal delivery to a process that has already exited: record as `failed` with reason.
  - Burst of signals (e.g., multiple rapid SIGWINCH): all are recorded individually.

### Subtask T010 - Wire lifecycle event publishing to local bus [P]

- Purpose: ensure all PTY lifecycle transitions are observable by the control plane and UI.
- Steps:
  1. Define event types: `pty.spawned`, `pty.state.changed`, `pty.output`, `pty.error`, `pty.stopped`, `pty.resized`, `pty.signal.delivered`.
  2. Each event includes: `ptyId`, `laneId`, `sessionId`, `terminalId`, `timestamp`, `correlationId`.
  3. Hook event emission into the state machine transition function: every successful transition emits `pty.state.changed`.
  4. Hook event emission into spawn (emit `pty.spawned` after successful spawn).
  5. Hook event emission into terminate (emit `pty.stopped` after cleanup).
  6. Use the local bus (spec 002) `publish()` API for all emissions.
  7. Events must be fire-and-forget on the hot path; bus failures must not block PTY operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/index.ts`
- Validation checklist:
  - [ ] Every state transition emits an event.
  - [ ] Events include all required correlation fields.
  - [ ] Bus failure does not block PTY operations.
  - [ ] Event schema matches spec 002 envelope format.
- Edge cases:
  - Bus unavailable at startup: events must be dropped with a warning, not queued indefinitely.
  - Rapid state transitions: all events emitted in order.

### Subtask T011 - Implement idle timeout detection transitioning PTY to `throttled` [P]

- Purpose: detect PTYs that stop producing output and may be hung or idle.
- Steps:
  1. Track the timestamp of the last output received from each PTY.
  2. Implement a configurable idle timeout (default: 300 seconds).
  3. Run a periodic check (every 30 seconds) across all `active` PTYs.
  4. If a PTY has been idle beyond the timeout, transition it to `throttled` via the state machine.
  5. Publish a `pty.idle_timeout` event with PTY ID, lane ID, and idle duration.
  6. If the PTY later produces output, transition back to `active`.
  7. Provide a way to disable idle timeout per-PTY for long-running processes that legitimately produce no output.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/state_machine.ts` (throttled transitions)
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/spawn.ts` or new idle monitor module
- Validation checklist:
  - [ ] Idle PTYs transition to `throttled` after timeout.
  - [ ] Output resumption transitions back to `active`.
  - [ ] Idle timeout is configurable and disableable per-PTY.
  - [ ] Periodic check does not block the event loop.
- Edge cases:
  - PTY that exits during idle timeout check: handle the state machine conflict gracefully.
  - Very short idle timeouts (< polling interval): document minimum effective timeout.

## Test Strategy

- Unit test every signal delivery path (SIGTERM, SIGKILL, SIGWINCH, SIGHUP) with mock processes.
- Unit test the escalation timer: verify SIGKILL is sent after grace period.
- Integration test: spawn a real PTY, write input, verify output, resize, verify SIGWINCH received, terminate, verify cleanup.
- Integration test: idle timeout triggers `throttled` transition.
- Benchmark: input-to-write latency p50 < 5ms, p95 < 15ms.

## Risks & Mitigations

- Risk: signal delivery races with process exit events.
- Mitigation: use a per-PTY operation lock to serialize signal delivery and exit handling.
- Risk: idle timeout false positives for legitimate long-idle processes.
- Mitigation: per-PTY disable flag and configurable timeout.

## Review Guidance

- Validate that input writes are zero-copy/minimal-copy.
- Validate signal delivery audit trail completeness.
- Confirm escalation timer is tested with mocked timers (no real 5-second waits in tests).
- Verify all event payloads include correlation IDs.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T12:32:12Z – claude-wp02-007 – shell_pid=81904 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:38:43Z – claude-wp02-007 – shell_pid=81904 – lane=for_review – Ready for review: PTY input/resize/terminate handlers, signal audit, bus events, idle timeout
