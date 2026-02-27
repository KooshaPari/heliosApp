---
work_package_id: WP01
title: Ghostty Process Lifecycle and Embedding
lane: "doing"
dependencies: []
base_branch: main
base_commit: 147b15897658867166faa3fd1352c2891545faa8
created_at: '2026-02-27T12:14:53.817183+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 - Ghostty Foundation
assignee: ''
agent: ''
shell_pid: "65285"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP01 - Ghostty Process Lifecycle and Embedding

## Objectives & Success Criteria

- Implement the ghostty renderer adapter conforming to the spec 010 RendererAdapter interface.
- Manage the ghostty process lifecycle (start, stop, restart, crash detection).
- Bind ghostty to the ElectroBun window surface for rendering.
- Report accurate capability matrix based on runtime GPU detection.

Success criteria:
- Ghostty registers with the renderer adapter without interface modification (SC-011-002).
- Process start/stop cycles cleanly with no resource leaks.
- Crash detection publishes error event within 500ms.
- Capability matrix reflects actual GPU availability.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/011-ghostty-renderer-backend/plan.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/adapter.ts` (spec 010 interface)

Constraints:
- Ghostty managed as a separate process, not in-process.
- Must conform to RendererAdapter interface exactly; no modifications.
- Crash detection latency < 500ms.
- Per-terminal memory overhead < 10 MB (NFR-011-004).

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Implement ghostty adapter class implementing RendererAdapter

- Purpose: provide the concrete ghostty implementation of the abstract renderer interface.
- Steps:
  1. Create `GhosttyBackend` class in `apps/runtime/src/renderer/ghostty/backend.ts` implementing `RendererAdapter`.
  2. Implement all interface methods:
     - `init(config)`: validate config, prepare ghostty process options, detect GPU.
     - `start(surface)`: delegate to process manager (T002), bind surface (T003).
     - `stop()`: delegate to process manager, release surface.
     - `bindStream(ptyId, stream)`: store stream binding, configure ghostty to render from this PTY.
     - `unbindStream(ptyId)`: remove stream binding from ghostty.
     - `handleInput(ptyId, data)`: relay input from ghostty event loop to the PTY write path.
     - `resize(ptyId, cols, rows)`: tell ghostty to resize the viewport for this PTY.
     - `queryCapabilities()`: delegate to capabilities module (T004).
     - `getState()`: return current renderer state.
     - `onCrash(handler)`: register crash callback.
  3. Store internal state: process reference, surface reference, bound streams, crash handler.
  4. Ensure `init` is idempotent; calling twice without stop throws.
  5. Set `id = 'ghostty'` and `version` from ghostty process detection.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/backend.ts`
- Validation checklist:
  - [ ] All RendererAdapter methods implemented.
  - [ ] Interface conformance: no extra public methods beyond the interface.
  - [ ] Init is idempotent-safe.
  - [ ] State getter returns correct state at all lifecycle points.
- Edge cases:
  - Start without init: must throw.
  - Stop when already stopped: idempotent.
  - Bind stream before start: must throw.
  - Multiple crash handlers: support or last-wins.

### Subtask T002 - Implement ghostty process lifecycle

- Purpose: manage the ghostty process from spawn to termination.
- Steps:
  1. Implement `GhosttyProcess` class in `apps/runtime/src/renderer/ghostty/process.ts`:
     - `start(options: GhosttyOptions): Promise<{ pid: number }>`:
       a. Spawn ghostty process via `Bun.spawn` with appropriate arguments for embedded mode.
       b. Configure ghostty to render to the provided surface (window ID or shared memory region).
       c. Monitor stdout/stderr for ghostty diagnostics.
       d. Return the process PID.
     - `stop(): Promise<void>`:
       a. Send SIGTERM to ghostty process.
       b. Wait up to 5 seconds for graceful exit.
       c. Send SIGKILL if not exited.
       d. Clean up file descriptors and resources.
     - `isRunning(): boolean`.
     - `getPid(): number | undefined`.
  2. Monitor the process for unexpected exit (crash):
     a. Attach an exit handler to the Bun.spawn process.
     b. If exit is unexpected (not triggered by stop()), invoke the crash handler within 500ms.
     c. Publish `renderer.crashed` event with exit code and signal info.
  3. Support restart: `restart()` calls stop() then start() with same options.
  4. Track process start time and uptime.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/process.ts`
- Validation checklist:
  - [ ] Process starts and returns valid PID.
  - [ ] Stop follows SIGTERM -> SIGKILL escalation.
  - [ ] Crash detection fires within 500ms.
  - [ ] Restart cycles cleanly.
  - [ ] No resource leaks after stop.
- Edge cases:
  - Ghostty binary not found: throw with clear diagnostic.
  - Ghostty crashes during start: detect immediately, report.
  - Stop when process already exited: idempotent.
  - Multiple rapid restarts: serialize with mutex.

### Subtask T003 - Implement ElectroBun window surface binding

- Purpose: connect ghostty rendering output to the ElectroBun window region.
- Steps:
  1. Implement `GhosttysSurface` class in `apps/runtime/src/renderer/ghostty/surface.ts`:
     - `bind(surface: RenderSurface, processPid: number): void`:
       a. Configure ghostty to render into the window region specified by surface bounds.
       b. Set up IPC or shared memory channel for frame delivery (depending on ghostty integration method).
       c. Handle surface resize events from ElectroBun.
     - `unbind(): void`:
       a. Disconnect ghostty from the surface.
       b. Release any shared memory or IPC resources.
     - `resize(bounds: { x, y, width, height }): void`:
       a. Update the render region.
       b. Notify ghostty of the new dimensions.
  2. Support different binding modes depending on platform:
     - macOS: native view embedding or offscreen buffer.
     - Linux: X11/Wayland surface sharing or offscreen buffer.
  3. Handle surface loss (window close) gracefully: unbind and notify adapter.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/surface.ts`
- Validation checklist:
  - [ ] Surface binding connects ghostty to window region.
  - [ ] Surface resize propagates to ghostty.
  - [ ] Unbind releases all resources.
  - [ ] Platform differences handled.
- Edge cases:
  - Window minimized: surface resize to zero bounds; handle gracefully.
  - Window closed while rendering: unbind, notify adapter.
  - Surface binding when ghostty is not running: throw.

### Subtask T004 - Implement ghostty capability matrix reporting

- Purpose: report actual runtime capabilities based on ghostty version and system GPU.
- Steps:
  1. Implement capability detection in `apps/runtime/src/renderer/ghostty/capabilities.ts`:
     - `detectCapabilities(): RendererCapabilities`:
       a. Query ghostty version for feature support.
       b. Detect GPU availability (check for GPU devices, driver version).
       c. Determine color depth support (24-bit typical).
       d. Check ligature support (depends on ghostty version and font config).
       e. Determine max dimensions from system display and GPU limits.
       f. Report supported input modes.
  2. Cache capabilities after detection (they do not change during a session).
  3. Return capabilities in < 50ms (NFR-010-003) -- caching ensures this.
  4. If GPU detection fails, report `gpuAccelerated: false` and degrade gracefully.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/capabilities.ts`
- Validation checklist:
  - [ ] Capabilities reflect actual GPU availability.
  - [ ] All RendererCapabilities fields populated.
  - [ ] Cached for fast query.
  - [ ] Graceful degradation when GPU unavailable.
- Edge cases:
  - No GPU on system: report gpuAccelerated false, software rendering.
  - GPU driver crash after detection: stale cache; support re-detection.

### Subtask T005 - Implement backend registration and export [P]

- Purpose: wire ghostty into the renderer system.
- Steps:
  1. Create `apps/runtime/src/renderer/ghostty/index.ts`:
     - Export `GhosttyBackend` class.
     - Export a `registerGhostty(registry: RendererRegistry): void` function that creates a GhosttyBackend instance and registers it.
     - Export types used by consumers.
  2. Registration must:
     a. Detect ghostty availability (binary present).
     b. Create the backend instance.
     c. Call `registry.register(backend)`.
  3. If ghostty is not available, log a warning and skip registration (do not throw).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/index.ts`
- Validation checklist:
  - [ ] Registration succeeds when ghostty is available.
  - [ ] Registration skips with warning when ghostty missing.
  - [ ] All public types exported.
  - [ ] No interface modifications required.

## Test Strategy

- Unit test adapter method delegation to process/surface/capabilities.
- Unit test process lifecycle with mocked Bun.spawn.
- Unit test crash detection timing (< 500ms).
- Unit test capability detection with mocked system info.
- Integration test: start/stop ghostty process (if ghostty installed).

## Risks & Mitigations

- Risk: ghostty embedding API is undocumented or unstable.
- Mitigation: start with process-based integration; iterate on embedding method.
- Risk: GPU detection is platform-specific and complex.
- Mitigation: start with basic detection; refine per platform.

## Review Guidance

- Validate adapter conforms exactly to RendererAdapter interface.
- Validate crash detection timing is tested with mocked timers.
- Confirm surface binding handles platform differences.
- Verify registration is graceful when ghostty is missing.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
