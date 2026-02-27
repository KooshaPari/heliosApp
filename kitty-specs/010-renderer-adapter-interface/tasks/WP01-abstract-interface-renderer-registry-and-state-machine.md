---
work_package_id: WP01
title: Abstract Interface, Renderer Registry, and State Machine
lane: "doing"
dependencies: []
base_branch: main
base_commit: 98f3236ffa670bb7161f21b79271c6ae261e7d57
created_at: '2026-02-27T11:58:04.015668+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Interface Definition
assignee: ''
agent: ''
shell_pid: "51331"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP01 - Abstract Interface, Renderer Registry, and State Machine

## Objectives & Success Criteria

- Define the abstract renderer adapter interface that all backends (ghostty, rio) must implement.
- Build a renderer state machine governing lifecycle transitions.
- Deliver a renderer registry for backend registration with metadata and capabilities.
- Implement transactional renderer switching with automatic rollback.
- Publish renderer lifecycle events to the local bus.

Success criteria:
- Mock backends can register without modifying the core interface.
- State machine enforces valid transitions and rejects invalid ones.
- Switch transaction either completes fully or rolls back cleanly.
- Exactly one renderer is active at any time.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/010-renderer-adapter-interface/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/010-renderer-adapter-interface/plan.md`
- Spec 002 (Local Bus) for events, spec 007 (PTY Lifecycle) for stream binding

Constraints:
- Interface must be open/closed: extensible for new backends without core changes (NFR-010-004).
- Switch must complete in p95 < 3 seconds (NFR-010-001).
- Adapter must not add more than 1 frame latency (< 16.7ms at 60 FPS) (NFR-010-002).
- Capability query must return in p95 < 50ms (NFR-010-003).

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Define abstract renderer adapter interface

- Purpose: establish the contract that all renderer backends must implement.
- Steps:
  1. Define `RendererAdapter` interface in `apps/runtime/src/renderer/adapter.ts`:
     ```typescript
     interface RendererAdapter {
       readonly id: string;           // e.g., 'ghostty', 'rio'
       readonly version: string;      // backend version
       init(config: RendererConfig): Promise<void>;
       start(surface: RenderSurface): Promise<void>;
       stop(): Promise<void>;
       bindStream(ptyId: string, stream: ReadableStream<Uint8Array>): void;
       unbindStream(ptyId: string): void;
       handleInput(ptyId: string, data: Uint8Array): void;
       resize(ptyId: string, cols: number, rows: number): void;
       queryCapabilities(): RendererCapabilities;
       getState(): RendererState;
       onCrash(handler: (error: Error) => void): void;
     }
     ```
  2. Define `RendererConfig`: `{ gpuAcceleration: boolean, colorDepth: number, maxDimensions: { cols, rows } }`.
  3. Define `RenderSurface`: `{ windowId: string, bounds: { x, y, width, height } }`.
  4. Define `RendererCapabilities`: `{ gpuAccelerated: boolean, colorDepth: number, ligatureSupport: boolean, maxDimensions: { cols, rows }, inputModes: string[] }`.
  5. Export all types for use by specs 011 and 012.
  6. Add JSDoc documentation on every method explaining contracts, error conditions, and threading expectations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/adapter.ts`
- Validation checklist:
  - [ ] Interface includes all lifecycle operations from FR-010-001.
  - [ ] Types are exported and importable by backend modules.
  - [ ] JSDoc on every method and type.
  - [ ] No concrete implementation in this file (pure interface).
- Edge cases:
  - Backend that cannot support GPU: must be expressible via capabilities.
  - Backend that does not support ligatures: capability matrix reflects this.

### Subtask T002 - Implement renderer state machine

- Purpose: govern renderer lifecycle with strict, deterministic transitions.
- Steps:
  1. Define `RendererState` enum: `uninitialized`, `initializing`, `running`, `switching`, `stopping`, `stopped`, `errored`.
  2. Define transition table:
     - `uninitialized -> initializing` (on init)
     - `initializing -> running` (on init success)
     - `initializing -> errored` (on init failure)
     - `running -> switching` (on switch request)
     - `running -> stopping` (on stop request)
     - `running -> errored` (on crash)
     - `switching -> running` (on switch success -- new renderer is running)
     - `switching -> running` (on switch rollback -- old renderer restored)
     - `switching -> errored` (on switch failure with rollback failure)
     - `stopping -> stopped` (on stop complete)
     - `errored -> initializing` (on recovery attempt)
     - `errored -> stopped` (on give up)
  3. Implement `transition(current, event): RendererState` with `InvalidRendererTransitionError`.
  4. Track transition history (last 10 transitions) for diagnostics.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/state_machine.ts`
- Validation checklist:
  - [ ] All states have defined outgoing transitions.
  - [ ] Invalid transitions throw with context.
  - [ ] Transition history captured.
  - [ ] `stopped` allows recovery via `errored -> initializing` path.
- Edge cases:
  - Switch initiated while already switching: reject.
  - Stop during initialization: must wait for init to complete, then stop.

### Subtask T003 - Implement renderer registry

- Purpose: manage registered renderer backends and enforce single-active constraint.
- Steps:
  1. Implement `RendererRegistry` class in `apps/runtime/src/renderer/registry.ts`:
     - `register(adapter: RendererAdapter): void` -- registers a backend; throws on duplicate ID.
     - `get(id: string): RendererAdapter | undefined`.
     - `list(): RendererAdapter[]` -- all registered backends.
     - `getActive(): RendererAdapter | undefined` -- the currently active renderer.
     - `setActive(id: string): void` -- marks a renderer as active; throws if ID not registered.
     - `clearActive(): void` -- clears active renderer (used during switch).
  2. Enforce exactly one active renderer at a time (FR-010-008).
  3. Store registration metadata: `{ id, version, registeredAt, capabilities }`.
  4. Provide `getCapabilities(id: string): RendererCapabilities` shortcut.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/registry.ts`
- Validation checklist:
  - [ ] Duplicate registration throws.
  - [ ] Single-active enforced.
  - [ ] Capabilities queryable per backend.
  - [ ] `getActive` returns undefined when none active.
- Edge cases:
  - Set active to unregistered ID: throw.
  - Clear active when none active: no-op.
  - Register with same ID and different version: reject (unregister first).

### Subtask T004 - Implement transactional renderer switch with rollback

- Purpose: switch between renderers atomically with automatic rollback on failure.
- Steps:
  1. Implement `switchRenderer(fromId: string, toId: string): Promise<void>` in `apps/runtime/src/renderer/switch.ts`:
     a. Validate both IDs are registered.
     b. Transition state to `switching`.
     c. Unbind all PTY streams from current renderer.
     d. Buffer PTY output (delegate to WP02 T008).
     e. Stop the current renderer (`adapter.stop()`).
     f. Start the new renderer (`adapter.init()` + `adapter.start(surface)`).
     g. Rebind all PTY streams to new renderer.
     h. Flush buffered output.
     i. Set new renderer as active.
     j. Transition state to `running`.
     k. Publish `renderer.switched` event.
  2. On any failure in steps f-h:
     a. Stop the new renderer (if it started).
     b. Restart the old renderer.
     c. Rebind streams to old renderer.
     d. Flush buffered output.
     e. Set old renderer as active.
     f. Transition state to `running` (rolled back).
     g. Publish `renderer.switch_failed` event with error details.
  3. If rollback also fails:
     a. Transition state to `errored`.
     b. Publish `renderer.errored` event.
  4. Enforce a total switch timeout of 3 seconds (NFR-010-001).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/switch.ts`
- Validation checklist:
  - [ ] Successful switch completes all steps in order.
  - [ ] Failed switch rolls back to previous renderer.
  - [ ] Rollback failure transitions to `errored`.
  - [ ] Total switch time < 3 seconds.
  - [ ] Events published for success, failure, and error.
- Edge cases:
  - Switch to the same renderer: no-op or reject.
  - Switch when no renderer is active: just start the new one.
  - Switch timeout: treat as failure, rollback.
  - Stream rebind failure during switch: rollback.

### Subtask T005 - Define capability matrix types and query interface [P]

- Purpose: enable capability-aware decisions before attempting renderer operations.
- Steps:
  1. Define `RendererCapabilities` in `apps/runtime/src/renderer/capabilities.ts`:
     ```typescript
     interface RendererCapabilities {
       gpuAccelerated: boolean;
       colorDepth: 8 | 16 | 24;
       ligatureSupport: boolean;
       maxDimensions: { cols: number; rows: number };
       inputModes: ('raw' | 'cooked' | 'application')[];
       sixelSupport: boolean;
       italicSupport: boolean;
       strikethroughSupport: boolean;
     }
     ```
  2. Implement `queryCapabilities(adapterId: string): RendererCapabilities` that delegates to the adapter.
  3. Implement `compareCapabilities(a: RendererCapabilities, b: RendererCapabilities): CapabilityDiff` for comparing two renderers.
  4. `CapabilityDiff`: list of features where the two differ.
  5. Capability query must return in p95 < 50ms (NFR-010-003).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/capabilities.ts`
- Validation checklist:
  - [ ] All capability fields from FR-010-007 are included.
  - [ ] Comparison produces meaningful diffs.
  - [ ] Query latency < 50ms.
- Edge cases:
  - Adapter not yet initialized: return static capabilities from registration metadata.
  - Capabilities change after init (runtime detection): support refresh.

### Subtask T006 - Wire renderer lifecycle event publishing to local bus [P]

- Purpose: make renderer state observable by the control plane and UI.
- Steps:
  1. Define event types: `renderer.initialized`, `renderer.started`, `renderer.switched`, `renderer.switch_failed`, `renderer.stopped`, `renderer.errored`, `renderer.crashed`.
  2. Each event includes: `rendererId`, `fromState`, `toState`, `timestamp`, `correlationId`.
  3. Switch events additionally include: `fromRenderer`, `toRenderer`, `switchDurationMs`.
  4. Error events include: `error`, `stack`.
  5. Hook into state machine transitions and switch logic.
  6. Events are fire-and-forget; bus failures do not block renderer operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/renderer/index.ts`
- Validation checklist:
  - [ ] All defined event types are emitted.
  - [ ] Events include correct correlation fields.
  - [ ] Bus failure does not block renderer ops.
- Edge cases:
  - Bus unavailable: events dropped with warning.

## Test Strategy

- Unit test state machine transitions (all valid/invalid).
- Unit test registry CRUD and single-active enforcement.
- Unit test switch transaction with mock adapters (success, failure, rollback, double failure).
- Unit test capability query and comparison.
- Verify mock backends register without interface modification.

## Risks & Mitigations

- Risk: switch transaction window is too long, causing visible disruption.
- Mitigation: buffer output, enforce 3-second timeout, optimize stop/start paths.
- Risk: interface too restrictive for future backends.
- Mitigation: keep interface minimal, use capability matrix for feature variation.

## Review Guidance

- Validate interface is truly abstract (no concrete behavior).
- Validate switch transaction handles all failure modes.
- Confirm single-active constraint is enforced at all times.
- Verify capability matrix includes all FR-010-007 fields.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
