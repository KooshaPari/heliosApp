---
work_package_id: WP02
title: Render Loop, Input Passthrough, and Frame Metrics
lane: "planned"
dependencies:
- WP01
subtasks:
- T006
- T007
- T008
- T009
phase: Phase 2 - Rendering Pipeline
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

# Work Package Prompt: WP02 - Render Loop, Input Passthrough, and Frame Metrics

## Objectives & Success Criteria

- Wire the ghostty render loop to produce frames at 60 FPS within the ElectroBun window.
- Implement bidirectional input passthrough between ghostty and PTYs.
- Collect and publish frame metrics for SLO monitoring.

Success criteria:
- Sustained 60 FPS under normal output load (NFR-011-003).
- Input-to-echo latency p50 < 30ms, p95 < 60ms (NFR-011-001).
- Frame metrics (frame time, FPS, input latency) published at configurable interval.
- Metrics emitted within 1 second of enabling collection (SC-011-004).

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/spec.md` (FR-011-002, FR-011-003, FR-011-005)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/plan.md`

Constraints:
- Ghostty handles GPU rendering internally; adapter monitors performance externally.
- Input passthrough must be zero-copy where possible.
- Metrics collection must not add measurable latency to the render path.
- Per-terminal memory overhead must remain < 10 MB (NFR-011-004).

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement render loop integration with ghostty at 60 FPS

- Purpose: ensure ghostty produces frames at the target rate.
- Steps:
  1. Configure ghostty process to render at 60 FPS (or matching display refresh rate).
  2. In `apps/runtime/src/renderer/ghostty/backend.ts`, implement the render loop monitoring:
     a. Track frame timestamps from ghostty (via IPC, shared memory fence, or process output parsing).
     b. Calculate actual FPS over a rolling 1-second window.
     c. Detect frame drops (< 55 FPS sustained for > 2 seconds) and publish `renderer.ghostty.fps_degraded` event.
  3. Handle the case where ghostty render loop stalls:
     a. If no frames for > 500ms, check if process is alive.
     b. If alive but stalled, log warning.
     c. If dead, trigger crash detection (WP01 T002).
  4. Support vsync configuration: enable/disable via RendererConfig.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/backend.ts`
- Validation checklist:
  - [ ] FPS tracking reflects actual render rate.
  - [ ] FPS degradation detected and published.
  - [ ] Render stall detected.
  - [ ] Vsync configurable.
- Edge cases:
  - Display refresh rate != 60 Hz: adapt target FPS.
  - Ghostty renders ahead of display: vsync should cap.
  - System under heavy load: FPS drops are detected, not masked.

### Subtask T007 - Implement input passthrough from ghostty to PTY write path

- Purpose: relay user keystrokes from ghostty to the correct PTY.
- Steps:
  1. Implement input relay in `apps/runtime/src/renderer/ghostty/input.ts`:
     - `setupInputRelay(ptyId: string, ghosttyProcess: GhosttyProcess): void`:
       a. Listen for input events from ghostty (via IPC channel, pipe, or event stream).
       b. For each input event, determine the target PTY (based on focused pane).
       c. Call `ptyManager.writeInput(ptyId, inputBytes)` (spec 007).
     - `teardownInputRelay(ptyId: string): void`.
  2. Input format: raw bytes (not key names) for terminal compatibility.
  3. Handle modifier keys, escape sequences, and special keys correctly.
  4. Measure input-to-PTY-write latency for NFR-011-001 compliance.
  5. Input relay must be minimal-latency; no buffering or batching.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/input.ts`
- Validation checklist:
  - [ ] Input bytes reach PTY without modification.
  - [ ] Correct PTY targeted based on focus.
  - [ ] Modifier keys and escape sequences preserved.
  - [ ] Latency measured per input event.
  - [ ] No buffering or batching.
- Edge cases:
  - Input while renderer is switching: buffer in switch buffer (spec 010 WP02).
  - Focus on a pane with no PTY: discard input, log warning.
  - Very rapid input (paste): all bytes delivered in order.

### Subtask T008 - Implement frame metrics collection

- Purpose: gather rendering performance data for SLO monitoring.
- Steps:
  1. Implement `GhosttyMetrics` class in `apps/runtime/src/renderer/ghostty/metrics.ts`:
     - Track per-frame data: `{ frameNumber, frameTimeMs, fpsInstant, timestamp }`.
     - Calculate rolling metrics over configurable window (default 1 second):
       - `avgFps`: average frames per second.
       - `p50FrameTime`, `p95FrameTime`: frame time percentiles.
       - `droppedFrames`: frames exceeding 2x target frame time.
     - Track input latency:
       - `p50InputLatency`, `p95InputLatency`: time from input event to echo visible.
       - Requires correlation between input timestamp and render timestamp.
     - `getSnapshot(): MetricsSnapshot` returns current rolling metrics.
     - `reset(): void` clears all metrics.
  2. Metrics collection must be zero-overhead when disabled.
  3. When enabled, per-frame overhead must be < 0.1ms.
  4. Store metrics in pre-allocated ring buffers to avoid GC pressure.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/metrics.ts`
- Validation checklist:
  - [ ] Frame time, FPS, and input latency tracked.
  - [ ] Percentile calculations correct.
  - [ ] Zero overhead when disabled.
  - [ ] Pre-allocated storage.
  - [ ] Snapshot returns current rolling window.
- Edge cases:
  - No frames rendered yet: snapshot returns empty/zero metrics.
  - Metrics enabled mid-session: start collecting from enable point.
  - Very high FPS (> 120): metrics handle correctly.

### Subtask T009 - Publish frame metrics to local bus at configurable intervals [P]

- Purpose: make metrics available to the control plane and diagnostics UI.
- Steps:
  1. Implement periodic metrics publishing in `apps/runtime/src/renderer/ghostty/metrics.ts`:
     - Configurable interval (default 1 second).
     - Publish `renderer.ghostty.metrics` event containing:
       - `avgFps`, `p50FrameTime`, `p95FrameTime`, `droppedFrames`
       - `p50InputLatency`, `p95InputLatency`
       - `timestamp`, `rendererId: 'ghostty'`
  2. First metrics event must be published within 1 second of enabling (SC-011-004).
  3. Stop publishing when metrics collection is disabled.
  4. Events are fire-and-forget; do not block the render path.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/metrics.ts`
- Validation checklist:
  - [ ] Metrics published at configured interval.
  - [ ] First event within 1 second of enable.
  - [ ] Publishing stops when disabled.
  - [ ] No render path blocking.
- Edge cases:
  - Bus unavailable: drop event with warning.
  - Interval set to 0: disable periodic publishing.

## Test Strategy

- Unit test metrics calculation with synthetic frame data.
- Unit test input relay with mock PTY manager.
- Integration test: start ghostty, generate output, verify FPS and frame metrics.
- Benchmark: measure actual input-to-echo latency.

## Risks & Mitigations

- Risk: ghostty does not expose frame timing information.
- Mitigation: infer from render surface updates or IPC signals.
- Risk: input latency measurement is inaccurate due to IPC overhead.
- Mitigation: measure at the adapter boundary; document measurement point.

## Review Guidance

- Validate input passthrough is truly zero-copy/minimal-copy.
- Validate metrics collection has near-zero overhead.
- Confirm FPS degradation detection thresholds are sensible.
- Verify metrics ring buffers are pre-allocated.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
