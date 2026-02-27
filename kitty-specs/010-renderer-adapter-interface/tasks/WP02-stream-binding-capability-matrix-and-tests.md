---
work_package_id: WP02
title: Stream Binding, Capability Matrix, and Tests
lane: "doing"
dependencies:
- WP01
base_branch: 010-renderer-adapter-interface-WP01
base_commit: a10ba7e1c9250e6cca5d8b90d257fd0f793b17d8
created_at: '2026-02-27T12:14:54.187231+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
phase: Phase 2 - Integration and Validation
assignee: ''
agent: ''
shell_pid: "65314"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Stream Binding, Capability Matrix, and Tests

## Objectives & Success Criteria

- Implement PTY stream binding/unbinding to the active renderer without data loss.
- Buffer output during renderer switches to prevent gaps.
- Build comprehensive tests for the entire renderer adapter interface.

Success criteria:
- PTY output continuity through renderer switches with zero data loss in controlled tests (SC-010-003).
- 100% of switches either complete or roll back cleanly (SC-010-001).
- Both mock ghostty and mock rio backends register without interface modification (SC-010-002).
- Test coverage >= 85% on renderer modules.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/010-renderer-adapter-interface/spec.md` (FR-010-005)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/010-renderer-adapter-interface/plan.md`
- Spec 007 (PTY Lifecycle) for stream sources

Constraints:
- Stream binding must not add more than 1 frame latency (< 16.7ms) (NFR-010-002).
- Output buffering during switch must not exceed PTY ring buffer caps.
- Switch must complete within 3 seconds including stream rebind.

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T007 - Implement PTY stream binding/unbinding to active renderer

- Purpose: connect PTY output streams to the renderer for frame production.
- Steps:
  1. Implement `StreamBindingManager` class in `apps/runtime/src/renderer/stream_binding.ts`:
     - `bind(ptyId: string, stream: ReadableStream<Uint8Array>, renderer: RendererAdapter): void`:
       a. Register the binding: `ptyId -> { stream, renderer }`.
       b. Start piping the stream to `renderer.bindStream(ptyId, stream)`.
       c. Set up input relay: `renderer.handleInput` writes to PTY via spec 007.
     - `unbind(ptyId: string): void`:
       a. Call `renderer.unbindStream(ptyId)`.
       b. Remove the binding record.
       c. Do NOT close the stream (PTY still owns it).
     - `rebindAll(newRenderer: RendererAdapter): void`:
       a. Unbind all streams from current renderer.
       b. Bind all streams to new renderer.
       c. Used during renderer switch.
     - `getBindings(): Map<string, StreamBinding>`.
     - `count(): number`.
  2. `StreamBinding`: `{ ptyId, stream, renderer, boundAt, bytesRelayed }`.
  3. Measure relay latency per binding for NFR-010-002 compliance.
  4. Handle the case where a PTY stream ends while bound: unbind automatically.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/stream_binding.ts`
- Validation checklist:
  - [ ] Bind connects stream to renderer.
  - [ ] Unbind disconnects without closing the stream.
  - [ ] RebindAll transfers all bindings atomically.
  - [ ] Relay latency measured.
  - [ ] Ended streams auto-unbind.
- Edge cases:
  - Bind a PTY already bound: replace existing binding (log warning).
  - Unbind a PTY not bound: no-op.
  - RebindAll with zero bindings: no-op.
  - Stream produces data faster than renderer consumes: rely on PTY backpressure (spec 007).

### Subtask T008 - Implement output buffering during renderer switch

- Purpose: prevent output loss during the window when no renderer is active.
- Steps:
  1. Implement `SwitchBuffer` class in `apps/runtime/src/renderer/stream_binding.ts`:
     - `startBuffering(): void` -- begins capturing all PTY output instead of sending to renderer.
     - `stopBuffering(renderer: RendererAdapter): void` -- flushes buffered data to the new renderer and resumes normal piping.
     - `getBufferedBytes(): number`.
  2. Buffer implementation: use a bounded queue (max capacity from PTY ring buffer config, default 4 MB per PTY).
  3. If buffer exceeds capacity during switch, drop oldest data and increment drop counter (same semantics as PTY backpressure).
  4. Wire into the switch transaction (WP01 T004): start buffering after unbind, stop buffering after rebind.
  5. Publish `renderer.switch.buffer_overflow` event if any data is dropped during switch.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/stream_binding.ts`
- Validation checklist:
  - [ ] Output produced during switch is captured.
  - [ ] Buffered data is flushed to new renderer after switch.
  - [ ] Buffer respects capacity limits.
  - [ ] Overflow event published if data dropped.
- Edge cases:
  - Switch completes instantly (no buffered data): flush is no-op.
  - Switch takes full 3 seconds with high-throughput PTY: buffer fills, drops oldest.
  - Multiple PTYs active during switch: each has independent buffering.

### Subtask T009 - Add Vitest unit tests for interface, registry, switch, and capabilities [P]

- Purpose: verify correctness of all renderer adapter components at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/renderer/`:
     - `state_machine.test.ts`: test every valid/invalid transition, transition history.
     - `registry.test.ts`: test register/get/list/active, single-active enforcement, duplicate rejection.
     - `switch.test.ts`: test successful switch, failed switch with rollback, double failure to errored state, switch timeout.
     - `capabilities.test.ts`: test capability query, comparison/diff.
     - `stream_binding.test.ts`: test bind/unbind/rebindAll, switch buffering, auto-unbind on stream end.
  2. Create mock renderer adapters:
     - `MockGhosttyAdapter` implementing `RendererAdapter` with configurable success/failure behavior.
     - `MockRioAdapter` implementing `RendererAdapter` with configurable success/failure behavior.
  3. Use Vitest fake timers for switch timeout tests.
  4. Target >= 85% coverage, >= 95% on switch.ts and state_machine.ts.
  5. Tag tests with FR/NFR IDs.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/state_machine.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/registry.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/switch.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/capabilities.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/stream_binding.test.ts`
- Validation checklist:
  - [ ] All state transitions tested.
  - [ ] Switch rollback tested with injected failures.
  - [ ] Mock backends register without interface modification.
  - [ ] FR/NFR traceability tags present.
  - [ ] Coverage >= 85%.

### Subtask T010 - Add integration tests with mock backends [P]

- Purpose: verify end-to-end renderer adapter behavior with mock backends.
- Steps:
  1. Create `apps/runtime/tests/integration/renderer/lifecycle.test.ts`.
  2. Test scenarios:
     a. Register mock ghostty and mock rio, verify both appear in registry.
     b. Init and start mock ghostty, verify state is `running`, verify active renderer is ghostty.
     c. Bind a mock PTY stream, verify data flows through to the renderer.
     d. Switch from ghostty to rio, verify state transitions, verify streams rebound, verify output continuity.
     e. Switch from rio back to ghostty, verify round-trip.
     f. Inject failure during switch (rio.start throws), verify rollback to ghostty.
  3. Each test cleans up all state.
  4. Tests complete in < 30 seconds.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/renderer/lifecycle.test.ts`
- Validation checklist:
  - [ ] All six scenarios pass.
  - [ ] Output continuity verified with byte counting.
  - [ ] Rollback verified with failure injection.
  - [ ] No leaked state after tests.

### Subtask T011 - Add renderer switch rollback stress test [P]

- Purpose: verify switch robustness under adverse conditions.
- Steps:
  1. Create `apps/runtime/tests/integration/renderer/switch_stress.test.ts`.
  2. Test scenarios:
     a. Rapid switch requests (10 switches in 5 seconds): verify only one executes at a time, others are rejected or queued.
     b. Switch with high-throughput PTY output: verify buffering captures data, no loss after successful switch.
     c. Switch with multiple PTYs bound (10 PTYs): verify all streams rebound.
     d. Switch failure at each step of the transaction: verify rollback at every point.
     e. Double failure (new renderer fails, rollback fails): verify transition to `errored`.
  3. Use mock adapters with configurable delays and failure injection.
  4. Report switch latency distribution.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/renderer/switch_stress.test.ts`
- Validation checklist:
  - [ ] Concurrent switch requests handled correctly.
  - [ ] No data loss during successful switch with active output.
  - [ ] Rollback works at every failure point.
  - [ ] Double failure transitions to errored.
  - [ ] Latency distribution reported.

## Test Strategy

- Run `vitest run --coverage` targeting `apps/runtime/src/renderer/`.
- Enforce >= 85% line coverage overall, >= 95% on switch.ts.
- Integration and stress tests run as separate targets.
- Mock adapters shared across unit and integration tests.

## Risks & Mitigations

- Risk: output buffering during switch is complex and error-prone.
- Mitigation: reuse PTY ring buffer pattern; bounded, well-tested.
- Risk: stream rebind races with new output arriving.
- Mitigation: rebind is synchronous within the event loop; no interleaving.

## Review Guidance

- Validate stream binding does not close PTY streams on unbind.
- Validate switch buffer handles multi-PTY case correctly.
- Confirm rollback stress test covers all failure injection points.
- Verify mock adapters are realistic (delays, error types).

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
