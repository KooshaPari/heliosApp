# Work Packages: Ghostty Renderer Backend

**Inputs**: Design documents from `/kitty-specs/011-ghostty-renderer-backend/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 010 (Renderer Adapter Interface)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/011-ghostty-renderer-backend/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Ghostty Process Lifecycle and Embedding (Priority: P0 — prerequisite to all other WPs)

**Phase**: Phase 1 - Ghostty Foundation
**Goal**: Implement the ghostty renderer adapter (spec 010 interface), manage the ghostty process lifecycle within the ElectroBun window, and register with the renderer registry including accurate capability matrix reporting.
**Independent Test**: Ghostty can be started, stopped, and restarted; it registers with the renderer adapter; crash detection fires within 500ms.
**Prompt**: `/kitty-specs/011-ghostty-renderer-backend/tasks/WP01-ghostty-process-lifecycle-and-embedding.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Implement ghostty adapter class implementing RendererAdapter interface in `apps/runtime/src/renderer/ghostty/backend.ts`
- [ ] T002 Implement ghostty process lifecycle (start/stop/crash detection) in `apps/runtime/src/renderer/ghostty/process.ts`
- [ ] T003 Implement ElectroBun window surface binding in `apps/runtime/src/renderer/ghostty/surface.ts`
- [ ] T004 Implement ghostty capability matrix reporting in `apps/runtime/src/renderer/ghostty/capabilities.ts`
- [ ] T005 [P] Implement backend registration and export in `apps/runtime/src/renderer/ghostty/index.ts`

### Implementation Notes
- Ghostty managed as a separate process (not in-process library) for portability.
- Crash detection: monitor process exit events, publish error within 500ms.
- Capability matrix must reflect actual runtime GPU availability, not static defaults.

### Parallel Opportunities
- T005 can proceed after T001 adapter interface is defined.

### Dependencies
- Depends on spec 010 (Renderer Adapter Interface).

### Risks & Mitigations
- Risk: ghostty embedding API is unstable.
- Mitigation: abstract behind process adapter; swap integration method without changing interface.

---

## Work Package WP02: Render Loop, Input Passthrough, and Frame Metrics (Priority: P1)

**Phase**: Phase 2 - Rendering Pipeline
**Goal**: Wire the ghostty render loop to produce frames at 60 FPS, pass user input from ghostty back to PTYs, and collect frame metrics (frame time, FPS, input latency) for SLO monitoring.
**Independent Test**: Terminal output renders at 60 FPS, input-to-echo latency meets SLO, and frame metrics are emitted on the bus.
**Prompt**: `/kitty-specs/011-ghostty-renderer-backend/tasks/WP02-render-loop-input-passthrough-and-frame-metrics.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T006 Implement render loop integration with ghostty at 60 FPS
- [ ] T007 Implement input passthrough from ghostty to PTY write path
- [ ] T008 Implement frame metrics collection (frame time, FPS, input latency) in `apps/runtime/src/renderer/ghostty/metrics.ts`
- [ ] T009 [P] Publish frame metrics to local bus at configurable intervals

### Implementation Notes
- Render loop: ghostty handles rendering; adapter monitors FPS and frame time.
- Input passthrough: ghostty captures keystrokes, adapter relays to PTY via spec 007 writeInput.
- Metrics interval: configurable, default every 1 second.

### Parallel Opportunities
- T009 can proceed after T008 metrics collection is functional.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: ghostty render loop integration is non-trivial for ElectroBun surface.
- Mitigation: start with shared memory or pipe-based frame transfer; optimize later.

---

## Work Package WP03: PTY Stream Piping, GPU Rendering, and Tests (Priority: P1)

**Phase**: Phase 3 - Integration and Validation
**Goal**: Wire PTY output streams to ghostty for rendering, verify GPU-accelerated rendering, and build comprehensive tests including SLO benchmarks.
**Independent Test**: PTY output renders through ghostty with GPU acceleration, SLO benchmarks pass on baseline hardware, and renderer switch preserves sessions.
**Prompt**: `/kitty-specs/011-ghostty-renderer-backend/tasks/WP03-pty-stream-piping-gpu-rendering-and-tests.md`
**Estimated Prompt Size**: ~390 lines

### Included Subtasks
- [ ] T010 Implement PTY output stream piping to ghostty render input
- [ ] T011 Implement GPU rendering surface integration with ElectroBun window
- [ ] T012 [P] Add Vitest unit tests for adapter, process lifecycle, metrics, and capabilities in `apps/runtime/tests/unit/renderer/ghostty/`
- [ ] T013 [P] Add integration tests for ghostty lifecycle and rendering in `apps/runtime/tests/integration/renderer/ghostty/`
- [ ] T014 [P] Add SLO benchmark tests: 60 FPS, input-to-echo < 60ms p95, memory < 10 MB per terminal

### Implementation Notes
- PTY stream piping: adapter receives ReadableStream from spec 007, feeds to ghostty process stdin or IPC channel.
- GPU rendering: ghostty handles GPU internally; adapter ensures surface is properly configured.
- SLO benchmarks must run on baseline hardware profile.

### Parallel Opportunities
- T012, T013, and T014 can all proceed in parallel once WP01 and WP02 are complete.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: GPU unavailable on CI.
- Mitigation: skip GPU-specific benchmarks on headless CI; run on dedicated hardware profile.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within each WP, marked [P] subtasks run in parallel.
- **MVP Scope**: All three WPs are required for MVP ghostty renderer.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Ghostty adapter implementing RendererAdapter | WP01 | P0 | No |
| T002 | Ghostty process lifecycle (start/stop/crash) | WP01 | P0 | No |
| T003 | ElectroBun surface binding | WP01 | P0 | No |
| T004 | Capability matrix reporting | WP01 | P0 | No |
| T005 | Backend registration and export | WP01 | P0 | Yes |
| T006 | Render loop at 60 FPS | WP02 | P1 | No |
| T007 | Input passthrough (ghostty -> PTY) | WP02 | P1 | No |
| T008 | Frame metrics collection | WP02 | P1 | No |
| T009 | Metrics publishing to bus | WP02 | P1 | Yes |
| T010 | PTY stream piping to ghostty | WP03 | P1 | No |
| T011 | GPU rendering surface integration | WP03 | P1 | No |
| T012 | Unit tests for ghostty adapter | WP03 | P1 | Yes |
| T013 | Integration tests for lifecycle/rendering | WP03 | P1 | Yes |
| T014 | SLO benchmark tests | WP03 | P1 | Yes |
