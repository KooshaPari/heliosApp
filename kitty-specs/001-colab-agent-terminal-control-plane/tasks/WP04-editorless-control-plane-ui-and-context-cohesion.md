---
work_package_id: WP04
title: Editorless Control Plane UI and Context Cohesion
lane: "for_review"
dependencies:
- WP03
base_branch: 001-colab-agent-terminal-control-plane-WP03
base_commit: f1d0bc01693c809a121c904e94a68cf81422b4a2
created_at: '2026-02-26T16:35:10.583835+00:00'
subtasks:
- T016
- T017
- T018
- T019
- T020
phase: Phase 3 - User Story 2
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

# Work Package Prompt: WP04 - Editorless Control Plane UI and Context Cohesion

## Objectives & Success Criteria

- Deliver a cohesive tabbed UI surface (terminal, agent, session, chat, project) sharing one active context.
- Wire UI actions to runtime lifecycle endpoints from prior WPs.
- Implement renderer mode switch transaction with rollback-safe UX.

Success criteria:
- Tab context stays synchronized while switching lanes/sessions.
- User can execute full editorless workflow without in-app code editor.
- Renderer switch failures recover safely and communicate status.

## Context & Constraints

Reference docs:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/quickstart.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/`

Constraints:
- UI remains terminal-first and editorless.
- Context switching should meet quick-response expectations.
- Diagnostics must expose harness transport and degradation reason.

Implementation command:
- `spec-kitty implement WP04 --base WP03`

## Subtasks & Detailed Guidance

### Subtask T016 - Build shared active-context store
- Purpose: single source of truth for workspace/lane/session/tab state.
- Steps:
  1. Implement typed state store in `apps/desktop/src/`.
  2. Add selectors/actions for active workspace, lane, session, and tab.
  3. Ensure updates are atomic and traceable from runtime events.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/`

### Subtask T017 - Implement unified tab surfaces
- Purpose: present editorless operational views bound to same context.
- Steps:
  1. Implement or refine tab components/views for terminal/agent/session/chat/project.
  2. Bind each tab to shared context store.
  3. Add empty/loading/error states for runtime call failures.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/`

### Subtask T018 - Wire UI actions to runtime lifecycle APIs
- Purpose: connect UX controls to actual lane/session/terminal operations.
- Steps:
  1. Implement client methods for lane create, session ensure, terminal spawn.
  2. Handle transport/degrade metadata in UI responses.
  3. Reflect state changes across all tabs.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/index.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/` (service modules)

### Subtask T019 - Implement renderer mode switch transaction/rollback
- Purpose: satisfy FR-007/FR-008 with user-visible safety.
- Steps:
  1. Add mode switch request flow in settings surface.
  2. Apply transactional switch with rollback and status reporting.
  3. Preserve active context after successful or failed switch.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/settings.ts`

### Subtask T020 - Add Playwright flows for tab sync and renderer safety
- Purpose: enforce end-to-end editorless workflow validation.
- Steps:
  1. Add flow tests for lane create + tab switching.
  2. Add tests for renderer switch success and rollback path.
  3. Assert context consistency and diagnostics visibility.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/tests/e2e/`
- Parallel: Yes.

## Test Strategy

- Run Playwright suite for editorless workflow and tab cohesion.
- Run unit tests for state store reducers/actions.
- Validate no stale context across tab switches.

## Risks & Mitigations

- Risk: context desynchronization across tabs.
- Mitigation: central state store and event-driven synchronization.
- Risk: renderer switch leaves UI unstable.
- Mitigation: transaction state machine with rollback + explicit user messaging.

## Review Guidance

- Verify all tab surfaces reflect identical active context identifiers.
- Verify renderer mode failure returns to stable prior mode.
- Verify diagnostics include harness routing and failures.

## Activity Log

- 2026-02-26T13:19:35Z – system – lane=planned – Prompt created.
- 2026-02-26T16:53:09Z – unknown – shell_pid=94640 – lane=for_review – Ready for review (forced lane move): editorless control plane UI/context cohesion implemented in worktree commit 5ce29c3.
