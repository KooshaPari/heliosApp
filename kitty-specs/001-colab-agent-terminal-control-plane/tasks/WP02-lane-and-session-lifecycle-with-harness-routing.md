---
work_package_id: WP02
title: Lane and Session Lifecycle with Harness Routing
lane: "for_review"
dependencies:
- WP01
base_branch: 001-colab-agent-terminal-control-plane-WP01
base_commit: f1d0bc01693c809a121c904e94a68cf81422b4a2
created_at: '2026-02-26T16:35:08.731270+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 2 - MVP Core Lifecycle
assignee: ''
agent: ''
shell_pid: "94640"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-26T13:19:35Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Lane and Session Lifecycle with Harness Routing

## Objectives & Success Criteria

- Implement lane lifecycle (`create/list/attach/cleanup`) and in-memory session registry with `codex_session_id` continuity.
- Route Codex provider through `cliproxyapi++` by default and degrade to native OpenAI when harness is unavailable.
- Expose API endpoints aligned with `control-plane.openapi.yaml` for lane/session/harness status.

Success criteria:
- Lane/session flows are stable and auditable.
- Harness outage does not break runtime usability.
- Integration tests verify healthy and degraded routes.

## Context & Constraints

Reference docs:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/plan.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/data-model.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/contracts/control-plane.openapi.yaml`

Key constraints:
- In-memory session state for slice-1.
- Explicit transport state (`cliproxy_harness` or `native_openai`).
- No silent fallback: degrade with explicit reason and event.

Implementation command:
- `spec-kitty implement WP02 --base WP01`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement lane lifecycle state machine
- Purpose: define canonical lane transitions and actions.
- Steps:
  1. Extend `apps/runtime/src/sessions/state_machine.ts` with lane transition graph.
  2. Implement create/list/attach/cleanup handlers with status updates.
  3. Emit lane lifecycle events on protocol bus.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/state_machine.ts`

### Subtask T007 - Implement in-memory session registry
- Purpose: map lane/session/codex identity for continuity and orchestration.
- Steps:
  1. Add registry module under `apps/runtime/src/sessions/`.
  2. Track `session_id`, `lane_id`, `codex_session_id`, transport, heartbeat.
  3. Enforce unique active mapping constraints.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/`

### Subtask T008 - Implement harness health monitor and route selector
- Purpose: keep primary harness route with safe degradation behavior.
- Steps:
  1. Add periodic and on-demand harness health checks in `integrations/exec.ts`.
  2. Implement route selection policy: harness first, native fallback on failure.
  3. Emit `harness.status.changed` events with reasons.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/exec.ts`

### Subtask T009 - Expose API endpoints
- Purpose: make lifecycle capabilities consumable by desktop UI.
- Steps:
  1. Add endpoint handlers for lane create, session ensure, and harness status.
  2. Validate request/response payloads against contract shapes.
  3. Wire handlers to state machine and registry services.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/index.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/` (new route modules if needed)

### Subtask T010 - Add integration tests for routing behavior
- Purpose: ensure robust behavior in both healthy and degraded harness modes.
- Steps:
  1. Add tests for harness healthy route and native fallback route.
  2. Verify transport field, diagnostics payload, and lifecycle events.
  3. Verify no runtime crash when harness becomes unavailable mid-flow.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/sessions/`
- Parallel: Yes (after endpoint contracts settle).

## Test Strategy

- Run session lifecycle integration suite via Vitest.
- Validate contract compatibility for endpoint response shapes.
- Include regression tests for fallback edge cases.

## Risks & Mitigations

- Risk: flap between harness and native routes.
- Mitigation: introduce cooldown/debounce for health transitions.
- Risk: registry inconsistency under rapid attach/cleanup.
- Mitigation: atomic updates and state transition checks.

## Review Guidance

- Check explicit degrade reasons in response and events.
- Verify API payloads match OpenAPI contract.
- Verify no hidden fallback path outside route selector.

## Activity Log

- 2026-02-26T13:19:35Z – system – lane=planned – Prompt created.
- 2026-02-26T16:53:08Z – unknown – shell_pid=94640 – lane=for_review – Ready for review (forced lane move): lane/session lifecycle + harness routing implemented in worktree commit d2eeca5; dependency rebase conflict pending.
