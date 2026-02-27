---
work_package_id: WP03
title: Bounded Output Buffering, Backpressure, and Tests
lane: "planned"
dependencies:
- WP01
- WP02
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
phase: Phase 3 - Stream Safety and Validation
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

# Work Package Prompt: WP03 - Bounded Output Buffering, Backpressure, and Tests

## Objectives & Success Criteria

- Deliver per-PTY ring buffers with configurable memory caps enforcing backpressure.
- Emit overflow telemetry when buffers are exhausted so output loss is visible.
- Build comprehensive unit, integration, and stress tests for the entire PTY lifecycle.

Success criteria:
- High-throughput output is buffered without exceeding per-PTY memory ceiling (default 4 MB).
- Backpressure signal is emitted when utilization exceeds threshold.
- Buffer overflow drops oldest data and emits telemetry, never crashes.
- All state machine transitions, registry ops, signal delivery, and I/O paths have test coverage >= 85%.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/spec.md` (FR-007-005, NFR-007-004)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/007-pty-lifecycle-manager/plan.md`

Constraints:
- Ring buffer hot path must not block the Bun event loop.
- Default per-PTY buffer cap: 4 MB (NFR-007-004), configurable.
- Backpressure threshold default: 75% utilization.
- Buffer write/read latency must be < 1ms p95.

Implementation command:
- `spec-kitty implement WP03 --base WP02`

## Subtasks & Detailed Guidance

### Subtask T012 - Implement per-PTY ring buffer with configurable memory cap

- Purpose: provide bounded output storage that prevents unbounded memory growth.
- Steps:
  1. Implement `RingBuffer` class in `apps/runtime/src/pty/buffers.ts`:
     - Constructor takes `capacity` in bytes (default 4 MB).
     - `write(data: Uint8Array): { written: number, dropped: number }` -- appends data, drops oldest bytes if capacity is exceeded. Returns count of written and dropped bytes.
     - `read(maxBytes?: number): Uint8Array` -- reads up to `maxBytes` from the buffer without removing.
     - `consume(maxBytes?: number): Uint8Array` -- reads and removes up to `maxBytes`.
     - `available(): number` -- bytes currently buffered.
     - `capacity(): number` -- total capacity.
     - `utilization(): number` -- fraction 0.0 to 1.0 of capacity used.
     - `clear(): void` -- empties the buffer.
  2. Use a pre-allocated `ArrayBuffer` as the backing store to avoid garbage collection pressure.
  3. Maintain head and tail pointers for O(1) write and read operations.
  4. Support wrapping around the buffer boundary transparently.
  5. Integrate with the PTY output stream: pipe PTY stdout into the ring buffer.
  6. Create a per-PTY `OutputBuffer` wrapper that holds the `RingBuffer` and tracks statistics (total written, total dropped, overflow events).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/buffers.ts`
- Validation checklist:
  - [ ] Pre-allocated ArrayBuffer, no dynamic growth.
  - [ ] Write/read wrap around buffer boundary correctly.
  - [ ] Dropped bytes count is accurate.
  - [ ] Capacity is configurable at construction.
  - [ ] Zero-length writes and reads are no-ops.
- Edge cases:
  - Write exactly equal to capacity: fills buffer, no drops.
  - Write larger than capacity: drops oldest, keeps most recent `capacity` bytes.
  - Read from empty buffer: returns empty Uint8Array.
  - Concurrent write/consume (in single-threaded Bun, this is sequential but test ordering).

### Subtask T013 - Implement backpressure signaling when buffer utilization exceeds threshold

- Purpose: alert consumers that they are falling behind PTY output production.
- Steps:
  1. Add a `backpressureThreshold` config to `OutputBuffer` (default 0.75).
  2. After each `write()`, check `utilization()` against the threshold.
  3. When utilization crosses above the threshold, emit a `pty.backpressure.on` event once (not repeatedly while above).
  4. When utilization drops below `backpressureThreshold - 0.1` (hysteresis band), emit a `pty.backpressure.off` event.
  5. Include PTY ID, lane ID, current utilization, and buffer stats in the event.
  6. Consumers (renderers, UI) should use backpressure signals to throttle their read rate or skip frames.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/buffers.ts`
- Validation checklist:
  - [ ] Backpressure event emitted exactly once when crossing above threshold.
  - [ ] Off event emitted when dropping below hysteresis band.
  - [ ] Hysteresis prevents rapid on/off toggling.
  - [ ] Events include utilization and buffer stats.
- Edge cases:
  - Utilization oscillates around threshold: hysteresis band prevents event flood.
  - Buffer cleared while backpressure is on: must emit `off` event.
  - Backpressure on a PTY that is being terminated: events still emitted for audit trail.

### Subtask T014 - Implement overflow telemetry emitting drop count and buffer stats

- Purpose: make output loss visible and measurable for diagnostics.
- Steps:
  1. After each `write()` that causes drops, increment a per-PTY drop counter.
  2. Emit a `pty.buffer.overflow` event at most once per second per PTY (debounced) containing:
     - `ptyId`, `laneId`, `sessionId`
     - `droppedBytesSinceLastEvent`
     - `totalDroppedBytes`
     - `bufferUtilization`
     - `timestamp`
  3. Expose cumulative overflow stats via the PTY manager API: `getBufferStats(ptyId): { totalWritten, totalDropped, currentUtilization, overflowEvents }`.
  4. Log a warning on first overflow per PTY.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/pty/buffers.ts`
- Validation checklist:
  - [ ] Overflow events are debounced to at most once per second.
  - [ ] Drop counters are accurate.
  - [ ] Stats are queryable via PTY manager.
  - [ ] First overflow logs a warning.
- Edge cases:
  - Sustained overflow: debounced events continue at 1/sec rate.
  - PTY terminated during overflow: final stats are captured before cleanup.

### Subtask T015 - Add Vitest unit tests for state machine, registry, and signals [P]

- Purpose: verify correctness of core PTY infrastructure at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/pty/`:
     - `state_machine.test.ts` -- test every valid transition, every invalid transition (expect throw), transition history recording, terminal state behavior.
     - `registry.test.ts` -- test register/get/update/remove, secondary indexes, capacity limits, duplicate rejection, bulk operations.
     - `signals.test.ts` -- test signal envelope creation, escalation timer with mocked timers, resize dimension validation, terminate idempotency.
  2. Use Vitest `vi.useFakeTimers()` for escalation timer tests.
  3. Target >= 95% coverage on state machine and registry modules.
  4. Tag tests with FR/NFR requirement IDs for traceability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/pty/state_machine.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/pty/registry.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/pty/signals.test.ts`
- Validation checklist:
  - [ ] Every state machine transition is tested (valid and invalid).
  - [ ] Registry secondary indexes verified after each mutation.
  - [ ] Escalation timer tested without real delays.
  - [ ] FR/NFR traceability tags present.
- Edge cases tested:
  - State machine: transition from terminal state, rapid sequential transitions.
  - Registry: remove non-existent PTY, update non-existent PTY.
  - Signals: signal to exited process, zero grace period.

### Subtask T016 - Add integration tests for full PTY lifecycle [P]

- Purpose: verify end-to-end PTY behavior with real processes.
- Steps:
  1. Create `apps/runtime/tests/integration/pty/lifecycle.test.ts`.
  2. Test scenarios:
     a. Spawn a PTY running `/bin/echo hello`, verify output contains "hello", verify state transitions: idle -> spawning -> active -> stopped.
     b. Spawn a PTY running `/bin/cat`, write input "test\n", verify echoed output, then terminate.
     c. Spawn a PTY, resize to 120x40, verify dimensions in registry, verify child received SIGWINCH (test with `stty size` output).
     d. Spawn a PTY, force-kill the child externally, verify transition to `errored` and error event published.
     e. Spawn multiple PTYs on different lanes, terminate one, verify others remain `active`.
  3. Use real Bun.spawn, not mocks.
  4. Each test must clean up all PTYs to avoid orphans.
  5. Assert event publication on the bus for each lifecycle transition.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/pty/lifecycle.test.ts`
- Validation checklist:
  - [ ] All five test scenarios pass.
  - [ ] No orphaned PTY processes after test suite.
  - [ ] Bus events verified for each transition.
  - [ ] Tests complete in < 30 seconds total.
- Edge cases tested:
  - PTY child exit code propagation (exit 0, exit 1, signal death).
  - Rapid spawn-then-terminate.

### Subtask T017 - Add stress test for buffer overflow semantics [P]

- Purpose: verify ring buffer behavior under sustained high-throughput output.
- Steps:
  1. Create `apps/runtime/tests/integration/pty/buffer_stress.test.ts`.
  2. Spawn a PTY running a command that produces output faster than consumption (e.g., `yes | head -c 50000000` for 50 MB output with a 4 MB buffer).
  3. Let the output fill the ring buffer and overflow.
  4. Verify:
     a. Buffer utilization never exceeds capacity (4 MB).
     b. Dropped bytes counter is > 0.
     c. Backpressure events were emitted.
     d. Overflow telemetry events were emitted (debounced).
     e. The runtime event loop remains responsive (measure a timer callback latency during the test).
  5. Test with different buffer sizes: 1 MB, 4 MB, 16 MB.
  6. Report throughput: bytes/second written, bytes/second consumed.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/pty/buffer_stress.test.ts`
- Validation checklist:
  - [ ] Buffer never exceeds capacity.
  - [ ] Drop counter matches expected drops.
  - [ ] Event loop latency stays < 50ms during overflow.
  - [ ] Test completes in < 60 seconds.
- Edge cases tested:
  - Zero-capacity buffer: all output is dropped.
  - Consumer that never reads: buffer fills and stays full, continuous overflow.

## Test Strategy

- Run `vitest run --coverage` targeting the `apps/runtime/src/pty/` source tree.
- Enforce >= 85% line coverage overall, >= 95% on state_machine.ts and registry.ts.
- Buffer stress test runs as a separate benchmark target, not in the default test suite.
- All tests clean up spawned processes to prevent test-induced orphans.

## Risks & Mitigations

- Risk: ring buffer implementation has off-by-one errors at wrap boundary.
- Mitigation: property-based testing with random read/write sequences.
- Risk: stress test is flaky due to timing.
- Mitigation: use generous timeouts and measure relative throughput, not absolute timing.

## Review Guidance

- Validate ring buffer is truly pre-allocated (no `new ArrayBuffer` on write).
- Validate backpressure hysteresis prevents event floods.
- Confirm stress test actually exceeds buffer capacity (check drop counter > 0).
- Verify test cleanup: no orphaned processes after suite completes.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
