---
work_package_id: WP03
title: PTY Stream Piping, GPU Rendering, and Tests
lane: "doing"
dependencies:
- WP01
- WP02
base_branch: 011-ghostty-renderer-backend-WP02
base_commit: 5e933ba625248b3c2ae0757ddb24f04ab89844db
created_at: '2026-02-27T12:32:36.636034+00:00'
subtasks:
- T010
- T011
- T012
- T013
- T014
phase: Phase 3 - Integration and Validation
assignee: ''
agent: "claude-wp03-011"
shell_pid: "82846"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 - PTY Stream Piping, GPU Rendering, and Tests

## Objectives & Success Criteria

- Wire PTY output streams to ghostty for rendering.
- Verify GPU-accelerated rendering surface integration.
- Build comprehensive unit, integration, and SLO benchmark tests.

Success criteria:
- PTY output flows through ghostty to the screen without data loss.
- GPU rendering is active on systems with GPU (NFR-011-004: < 10 MB per terminal overhead).
- SLO benchmarks pass: 60 FPS, input-to-echo p95 < 60ms, input-to-render p95 < 150ms (SC-011-001).
- Renderer switch ghostty -> rio -> ghostty preserves sessions (SC-011-003).
- Test coverage >= 85%.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/spec.md` (FR-011-003, FR-011-004)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/plan.md`
- Spec 007 (PTY Lifecycle) for stream sources, spec 010 for stream binding

Constraints:
- PTY streams are ReadableStream<Uint8Array> from spec 007.
- GPU rendering depends on platform; must degrade gracefully.
- SLO benchmarks require baseline hardware.

Implementation command:
- `spec-kitty implement WP03 --base WP02`

## Subtasks & Detailed Guidance

### Subtask T010 - Implement PTY output stream piping to ghostty

- Purpose: connect PTY output to ghostty's rendering input.
- Steps:
  1. In `GhosttyBackend.bindStream(ptyId, stream)`:
     a. Create a reader from the ReadableStream.
     b. Start a pump loop that reads chunks from the stream and writes them to ghostty's input channel (stdin pipe, IPC, or shared memory).
     c. Handle stream completion: when the PTY stream ends, notify ghostty to clear the terminal or show "process exited".
     d. Handle backpressure: if ghostty cannot consume fast enough, apply backpressure to the stream reader.
  2. In `GhosttyBackend.unbindStream(ptyId)`:
     a. Cancel the pump loop.
     b. Release the reader.
     c. Notify ghostty to stop rendering for this PTY.
  3. Support multiple bound streams (multiple PTYs in split panes):
     a. Each PTY maps to a ghostty rendering context (pane).
     b. Route output to the correct pane.
  4. Measure piping latency (stream read to ghostty write).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/backend.ts`
- Validation checklist:
  - [ ] PTY output reaches ghostty for rendering.
  - [ ] Stream end is handled gracefully.
  - [ ] Backpressure propagated to stream.
  - [ ] Multiple streams routed to correct panes.
  - [ ] Piping latency measured.
- Edge cases:
  - PTY produces zero output: ghostty shows empty terminal.
  - PTY produces binary data: ghostty renders raw bytes.
  - Stream canceled while ghostty is rendering: pump loop exits cleanly.

### Subtask T011 - Implement GPU rendering surface integration

- Purpose: ensure ghostty renders with GPU acceleration in the ElectroBun window.
- Steps:
  1. In the surface binding (WP01 T003), configure ghostty for GPU rendering:
     a. Pass GPU device preference to ghostty (if configurable).
     b. Verify GPU is actually in use after start (check ghostty diagnostics output or metrics).
  2. Handle GPU fallback:
     a. If GPU initialization fails, ghostty falls back to software rendering.
     b. Detect the fallback and update capability matrix to `gpuAccelerated: false`.
     c. Publish `renderer.ghostty.gpu_fallback` event.
  3. Monitor GPU memory usage per terminal:
     a. Track via system APIs or ghostty reporting.
     b. Alert if per-terminal overhead exceeds 10 MB (NFR-011-004).
  4. Handle GPU driver reset/crash:
     a. Detect via render stall or system event.
     b. Attempt to reinitialize GPU surface.
     c. Fall back to software rendering if reinit fails.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/surface.ts`
- Validation checklist:
  - [ ] GPU rendering active when GPU available.
  - [ ] Fallback to software rendering on GPU failure.
  - [ ] GPU fallback event published.
  - [ ] Memory usage monitored.
- Edge cases:
  - No GPU on system: software rendering from start, no fallback event.
  - GPU runs out of memory: detect, fall back.
  - Multiple displays with different GPUs: use the GPU for the display ghostty renders on.

### Subtask T012 - Add Vitest unit tests for ghostty adapter [P]

- Purpose: verify correctness of all ghostty backend components at the unit level.
- Steps:
  1. Create test files in `apps/runtime/tests/unit/renderer/ghostty/`:
     - `backend.test.ts`: test adapter lifecycle methods with mocked process and surface. Test init/start/stop sequencing, stream bind/unbind, state tracking.
     - `process.test.ts`: test process start/stop/crash detection with mocked Bun.spawn. Test SIGTERM/SIGKILL escalation, crash callback timing.
     - `metrics.test.ts`: test metrics calculation with synthetic frame data. Test percentile accuracy, rolling window, zero-overhead when disabled.
     - `capabilities.test.ts`: test capability detection with mocked system info. Test GPU/no-GPU scenarios.
     - `input.test.ts`: test input relay with mock PTY manager. Test byte passthrough, focus handling.
  2. Use Vitest fake timers for crash detection and metrics timing.
  3. Target >= 85% coverage.
  4. Tag with FR/NFR IDs.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/ghostty/backend.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/ghostty/process.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/ghostty/metrics.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/ghostty/capabilities.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/renderer/ghostty/input.test.ts`
- Validation checklist:
  - [ ] All adapter methods tested.
  - [ ] Crash detection timing tested.
  - [ ] Metrics accuracy tested.
  - [ ] Coverage >= 85%.

### Subtask T013 - Add integration tests for ghostty lifecycle and rendering [P]

- Purpose: verify end-to-end ghostty behavior with real process (when available).
- Steps:
  1. Create `apps/runtime/tests/integration/renderer/ghostty/lifecycle.test.ts`.
  2. Prerequisites: skip if ghostty binary not available.
  3. Test scenarios:
     a. Start ghostty, verify process running, stop, verify process exited.
     b. Start ghostty, bind a mock PTY stream, verify output is consumed.
     c. Start ghostty, force-kill process, verify crash callback fires within 500ms.
     d. Start ghostty, query capabilities, verify GPU field reflects system.
     e. Register ghostty with renderer adapter, verify it appears in registry.
  4. Clean up all processes after each test.
  5. Tests complete in < 60 seconds.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/renderer/ghostty/lifecycle.test.ts`
- Validation checklist:
  - [ ] All scenarios pass when ghostty available.
  - [ ] Tests skip gracefully when ghostty missing.
  - [ ] No orphaned processes after suite.

### Subtask T014 - Add SLO benchmark tests [P]

- Purpose: verify ghostty meets constitutional rendering performance targets.
- Steps:
  1. Create `apps/runtime/tests/benchmark/renderer/ghostty/slo.bench.ts`.
  2. Prerequisites: requires ghostty binary and GPU (skip on headless CI).
  3. Benchmarks:
     a. **FPS benchmark**: pipe 1 MB of terminal output, measure sustained FPS over 5 seconds. Target: >= 60 FPS.
     b. **Input-to-echo benchmark**: send 100 keystrokes, measure per-keystroke echo latency. Target: p50 < 30ms, p95 < 60ms.
     c. **Input-to-render benchmark**: measure time from keystroke to frame containing the echo. Target: p50 < 60ms, p95 < 150ms.
     d. **Memory benchmark**: start ghostty, bind 5 PTY streams, measure per-terminal memory overhead. Target: < 10 MB per terminal.
  4. Report results as structured JSON for CI tracking.
  5. Fail the benchmark if any target is not met.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/benchmark/renderer/ghostty/slo.bench.ts`
- Validation checklist:
  - [ ] FPS benchmark meets 60 FPS target.
  - [ ] Input latency meets SLO targets.
  - [ ] Memory overhead within 10 MB per terminal.
  - [ ] Results reported as structured JSON.
  - [ ] Fails when targets not met.

## Test Strategy

- Unit tests: mock Bun.spawn, mock system GPU info.
- Integration tests: real ghostty process, skip if unavailable.
- Benchmarks: require GPU hardware, separate CI target.
- Coverage target: >= 85% on ghostty modules.

## Risks & Mitigations

- Risk: SLO benchmarks are environment-dependent and flaky.
- Mitigation: run on dedicated baseline hardware, use generous warmup periods.
- Risk: ghostty integration details change with version.
- Mitigation: pin ghostty version, test with exact version.

## Review Guidance

- Validate PTY stream piping handles backpressure correctly.
- Validate GPU fallback detection is tested.
- Confirm SLO benchmarks have realistic workloads.
- Verify test cleanup leaves no orphaned processes.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T12:32:36Z – claude-wp03-011 – shell_pid=82846 – lane=doing – Assigned agent via workflow command
