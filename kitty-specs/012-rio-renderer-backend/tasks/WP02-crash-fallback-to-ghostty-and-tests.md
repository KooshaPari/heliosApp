---
work_package_id: WP02
title: Crash Fallback to Ghostty and Tests
lane: "doing"
dependencies:
- WP01
base_branch: 012-rio-renderer-backend-WP01
base_commit: f0b3edf963dcc5a7cd7ef5625d23c00fbf09aa6f
created_at: '2026-02-27T12:23:52.563205+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
phase: Phase 2 - Fallback and Validation
assignee: ''
agent: ''
shell_pid: "76982"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Crash Fallback to Ghostty and Tests

## Objectives & Success Criteria

- Implement automatic fallback from rio to ghostty when rio crashes.
- Handle feature flag toggle while rio is active (switch to ghostty first).
- Build comprehensive tests for fallback, feature flag enforcement, and SLO compliance.

Success criteria:
- Rio crash triggers automatic switch to ghostty with session preservation (SC-012-003).
- Feature flag disabled at runtime: rio is stopped, ghostty takes over.
- Zero rio processes/memory when flag disabled (SC-012-004).
- SLO benchmarks pass when rio is active (SC-012-001).
- Test coverage >= 85%.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/012-rio-renderer-backend/spec.md` (FR-012-007, FR-012-008)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/012-rio-renderer-backend/plan.md`
- Spec 010 (switch transaction for fallback), spec 011 (ghostty as fallback target)

Constraints:
- Fallback uses the renderer switch transaction from spec 010.
- Session preservation through switch: PTY streams must rebind without data loss.
- If ghostty is also unavailable, escalate to `errored` state.
- Feature flag toggle at runtime: stop rio, switch to ghostty, then mark flag disabled.

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T007 - Implement crash fallback to ghostty

- Purpose: ensure the system always has a working renderer.
- Steps:
  1. In `RioBackend.onCrash` handler implementation:
     a. Detect rio process exit (from WP01 T003 crash detection).
     b. Publish `renderer.rio.crashed` event with exit code, signal, and error details.
     c. Check if ghostty is registered and available in the renderer registry.
     d. If ghostty available, initiate a renderer switch from rio to ghostty using the spec 010 switch transaction (`switchRenderer('rio', 'ghostty')`).
     e. The switch transaction handles: stop rio (already stopped due to crash), start ghostty, rebind streams, flush buffers.
     f. If switch succeeds, publish `renderer.rio.fallback_to_ghostty` event.
     g. If ghostty is not available or switch fails, transition to `errored` state and publish `renderer.errored` event.
  2. Fallback must complete within 5 seconds (SC-010-004 from spec 010).
  3. Session preservation: all active PTY stream bindings must transfer to ghostty.
  4. Frame metrics must switch to ghostty metrics emission.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/backend.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/process.ts`
- Validation checklist:
  - [ ] Crash triggers automatic fallback to ghostty.
  - [ ] PTY streams rebound to ghostty.
  - [ ] Fallback event published.
  - [ ] Fallback completes within 5 seconds.
  - [ ] Ghostty unavailable escalates to errored.
- Edge cases:
  - Rio crashes during a switch from ghostty to rio: cancel switch, keep ghostty.
  - Rio crashes repeatedly: do not retry rio; stay on ghostty until manual intervention.
  - Ghostty also crashes during fallback: system in errored state, clear diagnostic.

### Subtask T008 - Implement feature flag toggle handling

- Purpose: handle disabling rio at runtime while it is the active renderer.
- Steps:
  1. Listen for configuration changes (feature flag toggle events from spec 004).
  2. When `rioRenderer` flag changes from true to false:
     a. If rio is the active renderer, initiate switch to ghostty.
     b. Wait for switch to complete.
     c. Unregister rio from the renderer registry.
     d. Publish `renderer.rio.disabled` event.
  3. When `rioRenderer` flag changes from false to true:
     a. Dynamically import and register rio.
     b. Do NOT automatically switch to rio; wait for explicit switch request.
     c. Publish `renderer.rio.enabled` event.
  4. Flag toggle during a switch: queue the toggle, apply after switch completes.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/index.ts`
- Validation checklist:
  - [ ] Disable while active: switch to ghostty, then unregister.
  - [ ] Enable while disabled: register, no automatic switch.
  - [ ] Toggle events published.
  - [ ] Toggle during switch: queued and applied after.
- Edge cases:
  - Rapid toggle on/off/on: serialize, apply final state.
  - Disable when rio is already not active: just unregister.
  - Enable when rio binary not available: warning, no registration.

### Subtask T009 - Add Vitest unit tests for rio adapter, feature flag, and fallback [P]

- Purpose: verify correctness of all rio backend components at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/renderer/rio/`:
     - `backend.test.ts`: test adapter lifecycle methods with mocked process and surface. Test feature flag rejection on disabled.
     - `process.test.ts`: test process lifecycle, crash detection, SIGTERM/SIGKILL escalation.
     - `feature_flag.test.ts`: test registration with flag on/off, dynamic import behavior, toggle handling.
     - `fallback.test.ts`: test crash fallback to ghostty with mocked switch transaction. Test ghostty unavailable scenario.
     - `metrics.test.ts`: test metrics schema matches ghostty.
  2. Use Vitest fake timers and mocked Bun.spawn.
  3. Target >= 85% coverage.
  4. Tag with FR/NFR IDs.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/rio/backend.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/rio/process.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/rio/feature_flag.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/rio/fallback.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/rio/metrics.test.ts`
- Validation checklist:
  - [ ] Adapter tested for all lifecycle methods.
  - [ ] Feature flag on/off tested.
  - [ ] Fallback tested with success and failure scenarios.
  - [ ] Metrics schema identity verified.
  - [ ] Coverage >= 85%.

### Subtask T010 - Add integration tests for rio lifecycle and fallback [P]

- Purpose: verify end-to-end rio behavior with real process (when available).
- Steps:
  1. Create `apps/runtime/tests/integration/renderer/rio/lifecycle.test.ts`.
  2. Prerequisites: skip if rio binary not available or feature flag not enabled.
  3. Test scenarios:
     a. Enable flag, register rio, start, verify rendering, stop, verify clean.
     b. Enable flag, start rio, force-kill rio process, verify fallback to ghostty, verify sessions preserved.
     c. Start rio, switch to ghostty, switch back to rio, verify round-trip.
     d. Register rio, query capabilities, verify fields populated.
  4. Clean up all processes after each test.
  5. Tests complete in < 60 seconds.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/renderer/rio/lifecycle.test.ts`
- Validation checklist:
  - [ ] All scenarios pass when rio available.
  - [ ] Fallback to ghostty verified with real processes.
  - [ ] Tests skip when rio not available.
  - [ ] No orphaned processes.

### Subtask T011 - Add feature flag zero-cost enforcement tests [P]

- Purpose: verify that disabled rio has absolutely zero runtime impact.
- Steps:
  1. Create `apps/runtime/tests/integration/renderer/rio/zero_cost.test.ts`.
  2. Test scenarios:
     a. Start runtime with rio flag disabled. Verify:
        - No rio process in process table (`ps aux | grep rio`).
        - No rio-related memory allocations (check heap snapshot or module cache for rio modules).
        - Rio module files not loaded (check Bun module cache if accessible).
     b. Attempt to switch to rio with flag disabled: verify rejection with `FeatureFlagDisabledError`.
     c. Verify rio does not appear in renderer registry when flag disabled.
  3. These tests must pass on systems where rio binary is installed (flag overrides availability).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/renderer/rio/zero_cost.test.ts`
- Validation checklist:
  - [ ] No rio process when flag off.
  - [ ] No rio module loading when flag off.
  - [ ] Switch to rio rejected when flag off.
  - [ ] Rio not in registry when flag off.

### Subtask T012 - Add SLO benchmark tests for rio [P]

- Purpose: verify rio meets the same performance targets as ghostty.
- Steps:
  1. Create `apps/runtime/tests/benchmark/renderer/rio/slo.bench.ts`.
  2. Prerequisites: requires rio binary, GPU, and feature flag enabled.
  3. Benchmarks (identical targets to ghostty spec 011):
     a. **FPS benchmark**: pipe 1 MB terminal output, measure sustained FPS. Target: >= 60 FPS.
     b. **Input-to-echo benchmark**: 100 keystrokes, measure latency. Target: p50 < 30ms, p95 < 60ms.
     c. **Input-to-render benchmark**: keystroke to frame. Target: p50 < 60ms, p95 < 150ms.
     d. **Memory benchmark**: 5 PTY streams, measure per-terminal overhead. Target: < 10 MB per terminal.
  4. Report results as structured JSON.
  5. Fail if targets not met.
  6. Compare results against ghostty benchmarks for regression detection.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/benchmark/renderer/rio/slo.bench.ts`
- Validation checklist:
  - [ ] FPS meets 60 FPS target.
  - [ ] Input latency meets SLO.
  - [ ] Memory within 10 MB per terminal.
  - [ ] Results in structured JSON.
  - [ ] Comparison against ghostty results.

## Test Strategy

- Unit tests with mocked process and config.
- Integration tests: real rio process, skip if unavailable.
- Zero-cost tests: verify no rio artifacts when flag off.
- Benchmarks: separate CI target requiring GPU and rio binary.
- Coverage target: >= 85%.

## Risks & Mitigations

- Risk: fallback race between crash detection and switch transaction.
- Mitigation: crash handler is serialized through the renderer switch mutex.
- Risk: zero-cost verification is platform-dependent.
- Mitigation: test module loading behavior specifically; accept process-table check as secondary.

## Review Guidance

- Validate crash fallback uses spec 010 switch transaction (not custom logic).
- Validate feature flag toggle handles all timing scenarios.
- Confirm zero-cost tests actually verify module non-loading.
- Verify SLO benchmarks use identical methodology to ghostty.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
