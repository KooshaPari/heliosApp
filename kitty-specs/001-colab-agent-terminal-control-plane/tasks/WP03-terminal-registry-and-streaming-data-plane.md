---
work_package_id: "WP03"
subtasks:
  - "T011"
  - "T012"
  - "T013"
  - "T014"
  - "T015"
title: "Terminal Registry and Streaming Data Plane"
phase: "Phase 2 - MVP Core Lifecycle"
lane: "planned"
dependencies:
  - "WP02"
assignee: ""
agent: ""
shell_pid: ""
review_status: ""
reviewed_by: ""
history:
  - timestamp: "2026-02-26T13:19:35Z"
    lane: "planned"
    agent: "system"
    shell_pid: ""
    action: "Prompt generated via /spec-kitty.tasks"
---

# Work Package Prompt: WP03 - Terminal Registry and Streaming Data Plane

## Objectives & Success Criteria

- Build terminal lifecycle operations and registry mapping to workspace/lane/session.
- Ensure stable stream handling with bounded buffers suitable for low-memory devices.
- Emit terminal lifecycle/audit events with deterministic ordering.

Success criteria:
- Terminal spawn/input/resize/output flows work for multiple lanes.
- Registry mapping prevents cross-lane leakage.
- Stream path remains stable under burst output.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/data-model.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/contracts/control-plane.openapi.yaml`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/contracts/orchestration-envelope.schema.json`

Constraints:
- Keep output ring buffers bounded and instrument overflow.
- Preserve ordering and correlation semantics from WP01.

Implementation command:
- `spec-kitty implement WP03 --base WP02`

## Subtasks & Detailed Guidance

### Subtask T011 - Implement terminal registry mapping
- Purpose: maintain authoritative terminal context mapping.
- Steps:
  1. Create registry service in runtime sessions domain.
  2. Map each terminal to `workspace_id`, `lane_id`, `session_id`.
  3. Provide query/update APIs used by handlers and UI calls.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/`

### Subtask T012 - Implement spawn/input/resize handlers
- Purpose: expose terminal command lifecycle on runtime boundary.
- Steps:
  1. Implement spawn handler tied to ensured session.
  2. Implement input and resize handlers with validation.
  3. Ensure handler responses include consistent IDs and state.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/exec.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/index.ts`

### Subtask T013 - Add bounded output buffering and backpressure
- Purpose: avoid unbounded memory growth in terminal stream path.
- Steps:
  1. Implement per-terminal ring buffer with configurable cap.
  2. Add overflow signaling/telemetry path.
  3. Ensure output dispatch avoids blocking control-plane loop.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/` (stream-related modules)

### Subtask T014 - Emit and persist terminal lifecycle events
- Purpose: preserve traceability and deterministic transitions.
- Steps:
  1. Emit `terminal.spawned`, `terminal.output`, `terminal.state.changed` envelopes.
  2. Route events through protocol bus and audit sink.
  3. Attach correlation and context IDs consistently.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/`

### Subtask T015 - Add terminal lifecycle tests
- Purpose: verify lifecycle correctness and buffering behavior.
- Steps:
  1. Add unit tests for registry transitions.
  2. Add integration tests for spawn/input/resize/output.
  3. Add stress test for bounded buffer overflow semantics.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/`
- Parallel: Yes.

## Test Strategy

- Run runtime unit and integration tests for terminal flow.
- Add assertions for context mapping and event order.
- Validate buffer cap behavior with synthetic high-output workloads.

## Risks & Mitigations

- Risk: terminal buffer overflows silently.
- Mitigation: explicit overflow events and visibility in diagnostics.
- Risk: state mismatch between registry and session manager.
- Mitigation: enforce synchronized update points with state-machine checks.

## Review Guidance

- Validate no cross-session output leakage.
- Validate registry lifecycle cleanup on terminal/session termination.
- Confirm event payload completeness for audit.

## Activity Log

- 2026-02-26T13:19:35Z – system – lane=planned – Prompt created.
