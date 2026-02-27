---
work_package_id: WP01
title: Rio Adapter Implementing 010 Interface with Feature Flag
lane: "planned"
dependencies: []
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Rio Foundation
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

# Work Package Prompt: WP01 - Rio Adapter Implementing 010 Interface with Feature Flag

## Objectives & Success Criteria

- Implement the rio renderer adapter conforming to spec 010 RendererAdapter interface.
- Gate rio behind a feature flag that is off by default with zero runtime cost when disabled.
- Manage rio process lifecycle, surface binding, capability reporting, and metrics.
- Metrics must use identical schema to ghostty for renderer-agnostic monitoring.

Success criteria:
- Rio registers with the renderer adapter using the same interface as ghostty (SC-012-002).
- Feature flag disabled: zero rio processes, zero rio memory allocations (SC-012-004).
- Feature flag enabled: rio initializes and renders correctly.
- Capability matrix accurately reflects rio's runtime features.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/012-rio-renderer-backend/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/012-rio-renderer-backend/plan.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/adapter.ts` (spec 010)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/ghostty/` (reference implementation)

Constraints:
- Must conform to RendererAdapter interface without modifications (NFR-010-004).
- Feature flag off = zero runtime cost: no module loading beyond the flag check (NFR-012-005).
- Metrics schema identical to ghostty (FR-012-005).
- Performance targets same as ghostty: input-to-echo p50 < 30ms / p95 < 60ms, 60 FPS.

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Implement feature flag gate for rio

- Purpose: ensure rio has zero runtime cost when disabled.
- Steps:
  1. Create `apps/runtime/src/renderer/rio/index.ts`:
     - `registerRio(registry: RendererRegistry, config: AppConfig): void`:
       a. Check `config.featureFlags.rioRenderer` (or equivalent config path).
       b. If disabled (default): return immediately. Do not import rio modules. Do not create any objects. Log "Rio renderer: disabled by feature flag" at debug level.
       c. If enabled: dynamically import the rio backend module (`await import('./backend')`).
       d. Detect rio binary availability.
       e. If rio binary not found: log warning, return without registering.
       f. Create `RioBackend` instance and register.
  2. Use dynamic import (`await import()`) so the rio module code is never loaded when the flag is off.
  3. Verify zero-cost: no rio-related entries in the module graph when flag is off.
  4. Export `isRioEnabled(config: AppConfig): boolean` utility for use elsewhere.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/index.ts`
- Validation checklist:
  - [ ] Flag off: no dynamic import, no object creation, no process spawn.
  - [ ] Flag on: rio module loaded and backend registered.
  - [ ] Missing rio binary with flag on: warning, no registration.
  - [ ] `isRioEnabled` utility works correctly.
- Edge cases:
  - Flag toggled from off to on at runtime: not supported in slice-1; requires restart.
  - Config file missing flag key: default to disabled.
  - Dynamic import fails (module not found): log error, return.

### Subtask T002 - Implement rio adapter class implementing RendererAdapter

- Purpose: provide the concrete rio implementation of the abstract renderer interface.
- Steps:
  1. Create `RioBackend` class in `apps/runtime/src/renderer/rio/backend.ts` implementing `RendererAdapter`.
  2. Mirror the structure of `GhosttyBackend` (spec 011):
     - `init(config)`: validate config, prepare rio process options, detect GPU.
     - `start(surface)`: delegate to process manager (T003), bind surface (T004).
     - `stop()`: delegate to process manager, release surface.
     - `bindStream(ptyId, stream)`: store binding, configure rio.
     - `unbindStream(ptyId)`: remove binding.
     - `handleInput(ptyId, data)`: relay input from rio to PTY.
     - `resize(ptyId, cols, rows)`: resize rio viewport.
     - `queryCapabilities()`: delegate to capabilities module (T005).
     - `getState()`: return current state.
     - `onCrash(handler)`: register crash callback.
  3. Set `id = 'rio'` and `version` from rio process detection.
  4. Ensure `init` is idempotent-safe.
  5. Reject all operations when feature flag is disabled (FR-012-008).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/backend.ts`
- Validation checklist:
  - [ ] All RendererAdapter methods implemented.
  - [ ] Interface conformance: same contract as ghostty.
  - [ ] Operations rejected when flag disabled.
  - [ ] State getter accurate at all lifecycle points.
- Edge cases:
  - Switch request to rio when flag disabled: rejected with `FeatureFlagDisabledError`.
  - Start without init: throws.
  - Stop when already stopped: idempotent.

### Subtask T003 - Implement rio process lifecycle

- Purpose: manage the rio process from spawn to termination.
- Steps:
  1. Implement `RioProcess` class in `apps/runtime/src/renderer/rio/process.ts`:
     - Same pattern as `GhosttyProcess` (spec 011 WP01 T002).
     - `start(options: RioOptions): Promise<{ pid: number }>`: spawn rio via Bun.spawn.
     - `stop(): Promise<void>`: SIGTERM -> SIGKILL escalation.
     - `isRunning(): boolean`.
     - `getPid(): number | undefined`.
  2. Crash detection: monitor process exit, invoke crash handler within 500ms.
  3. On crash, additionally trigger fallback logic (WP02 T007).
  4. Track process uptime.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/process.ts`
- Validation checklist:
  - [ ] Process starts and returns valid PID.
  - [ ] Stop follows escalation pattern.
  - [ ] Crash detection within 500ms.
  - [ ] No resource leaks after stop.
- Edge cases:
  - Rio binary not found: throw with diagnostic.
  - Rio crashes during start: detect, report.
  - Multiple rapid restarts: serialize.

### Subtask T004 - Implement rio surface binding and PTY stream piping

- Purpose: connect rio to the ElectroBun window and feed PTY output.
- Steps:
  1. Implement `RioSurface` class in `apps/runtime/src/renderer/rio/surface.ts`:
     - Same pattern as ghostty surface binding (spec 011 WP01 T003).
     - `bind(surface, pid)`: configure rio to render into window region.
     - `unbind()`: disconnect, release resources.
     - `resize(bounds)`: update render region.
  2. Implement PTY stream piping in `RioBackend.bindStream`:
     - Same pump loop pattern as ghostty (spec 011 WP03 T010).
     - Read from PTY ReadableStream, write to rio input channel.
     - Handle backpressure, stream end, multiple streams.
  3. Handle platform differences (macOS vs Linux rendering surfaces).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/surface.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/backend.ts`
- Validation checklist:
  - [ ] Surface binding connects rio to window.
  - [ ] PTY output reaches rio for rendering.
  - [ ] Backpressure propagated.
  - [ ] Unbind releases all resources.
- Edge cases:
  - Window minimized: handle zero-size surface.
  - Stream end while rendering: clean up gracefully.

### Subtask T005 - Implement rio capability matrix and frame metrics

- Purpose: report capabilities and metrics using the same schema as ghostty.
- Steps:
  1. Implement capability detection in `apps/runtime/src/renderer/rio/capabilities.ts`:
     - Same `RendererCapabilities` type as ghostty.
     - Detect GPU availability, color depth, feature support for rio specifically.
     - Cache capabilities after detection.
  2. Implement frame metrics in `apps/runtime/src/renderer/rio/metrics.ts`:
     - Same `MetricsSnapshot` type and event schema as ghostty.
     - Same `renderer.rio.metrics` event (or reuse `renderer.metrics` with `rendererId: 'rio'`).
     - Same collection methodology: frame time, FPS, input latency, percentiles.
     - Same rolling window and configurable interval.
  3. Ensure metrics events are schema-identical to ghostty for renderer-agnostic dashboards.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/capabilities.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/metrics.ts`
- Validation checklist:
  - [ ] Capabilities reflect rio's actual features.
  - [ ] Metrics schema identical to ghostty.
  - [ ] Metrics events include `rendererId: 'rio'`.
  - [ ] Capability query < 50ms (cached).
- Edge cases:
  - Rio has different features than ghostty: capability matrix reflects actual rio features.
  - Rio does not support ligatures: report `ligatureSupport: false`.

### Subtask T006 - Implement input passthrough from rio to PTY [P]

- Purpose: relay user input from rio back to PTYs.
- Steps:
  1. Implement input relay in `apps/runtime/src/renderer/rio/input.ts`:
     - Same pattern as ghostty input passthrough (spec 011 WP02 T007).
     - Listen for input events from rio process.
     - Route to correct PTY based on focused pane.
     - Call `ptyManager.writeInput(ptyId, inputBytes)`.
  2. Raw bytes, not key names.
  3. Handle modifier keys and escape sequences.
  4. Measure input-to-PTY-write latency.
  5. No buffering or batching.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/rio/input.ts`
- Validation checklist:
  - [ ] Input bytes reach PTY without modification.
  - [ ] Correct PTY targeted.
  - [ ] Latency measured.
  - [ ] No buffering.
- Edge cases:
  - Input during renderer switch: handled by spec 010 switch buffer.
  - Focus on pane with no PTY: discard with warning.

## Test Strategy

- Unit tests with mocked Bun.spawn and mocked config.
- Feature flag tests: verify zero module loading when disabled.
- Metrics schema comparison test: verify rio and ghostty produce identical event shapes.
- Integration tests: real rio process (when available).

## Risks & Mitigations

- Risk: rio embedding API is less documented than ghostty.
- Mitigation: follow same process-based pattern; adapt as needed.
- Risk: zero-cost flag check is violated by eager module loading.
- Mitigation: use dynamic import; verify with module graph analysis.

## Review Guidance

- Validate feature flag truly prevents all rio code execution when off.
- Validate adapter conforms exactly to RendererAdapter (same as ghostty).
- Confirm metrics schema is identical to ghostty.
- Verify zero-cost claim with module loading analysis.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
