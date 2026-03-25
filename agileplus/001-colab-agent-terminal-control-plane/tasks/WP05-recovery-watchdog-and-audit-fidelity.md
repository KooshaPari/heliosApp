---
work_package_id: WP05
title: Recovery, Watchdog, and Audit Fidelity
lane: "for_review"
dependencies:
- WP03
base_branch: 001-colab-agent-terminal-control-plane-WP03
base_commit: f1d0bc01693c809a121c904e94a68cf81422b4a2
created_at: '2026-02-26T16:35:11.536188+00:00'
subtasks:
- T021
- T022
- T023
- T024
- T025
phase: Phase 3 - User Story 1 hardening
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

# Work Package Prompt: WP05 - Recovery, Watchdog, and Audit Fidelity

## Objectives & Success Criteria

- Deliver restart recovery behavior for slice-1 continuity using `codex_session_id`-based reattachment.
- Detect orphaned lane/session artifacts and provide actionable remediation paths.
- Enforce auditable lifecycle records and normalized failure surfaces across boundaries.

Success criteria:
- Controlled restart drills reattach recoverable sessions.
- Watchdog surfaces consistent remediation guidance for unrecoverable artifacts.
- Audit records reconstruct key lifecycle actions with correlation IDs.

## Context & Constraints

Reference docs:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/research.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/quickstart.md`

Constraints:
- Slice-1 uses in-memory runtime state; recovery must leverage reconnect metadata and codex IDs.
- External boundary failures must never crash local runtime control.
- Audit payloads must avoid secret leakage.

Implementation command:
- `spec-kitty implement WP05 --base WP03`

## Subtasks & Detailed Guidance

### Subtask T021 - Implement restart recovery bootstrap
- Purpose: restore runtime operability and reattach recoverable sessions.
- Steps:
  1. Add startup recovery routine in runtime entrypoint.
  2. Rebuild registries from available in-memory/reconnect metadata.
  3. Reattach sessions by `codex_session_id` where possible.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/index.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/`

### Subtask T022 - Implement orphan watchdog and remediation flow
- Purpose: detect lane/session drift and present safe cleanup/reconcile actions.
- Steps:
  1. Add periodic orphan scanner for lane/session/terminal mapping divergence.
  2. Classify drift states (recoverable/unrecoverable).
  3. Expose remediation APIs/events for UI diagnostics panel.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/sessions/`

### Subtask T023 - Implement lifecycle audit fidelity and export hooks
- Purpose: support incident traceability and operational review.
- Steps:
  1. Extend audit sink from WP01 to persist immutable event records.
  2. Support filtering by workspace/lane/session/correlation IDs.
  3. Add export hook for session-level audit bundle generation.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/`

### Subtask T024 - Normalize protocol-boundary failures
- Purpose: stabilize failure semantics across local/external boundaries.
- Steps:
  1. Define canonical error codes (for example `SESSION_NOT_FOUND`, `HARNESS_UNAVAILABLE`).
  2. Ensure API and event payloads use normalized structures.
  3. Ensure user-facing messages remain actionable and safe.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/index.ts`

### Subtask T025 - Add recovery and chaos tests
- Purpose: validate restart and failure behavior against NFR goals.
- Steps:
  1. Add controlled restart tests with recoverable and unrecoverable scenarios.
  2. Add boundary failure drill tests for graceful degradation.
  3. Validate audit timeline completeness after drills.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/integration/recovery/`
- Parallel: Yes.

## Test Strategy

- Integration tests for restart and orphan scenarios.
- Chaos-style boundary failure injection tests.
- Audit verification assertions (ordering, correlation presence, non-empty timeline).

## Risks & Mitigations

- Risk: false-positive orphan detection causing disruptive cleanup prompts.
- Mitigation: multi-signal validation before remediation recommendation.
- Risk: audit sink overhead on hot path.
- Mitigation: asynchronous buffered writes with bounded queue.

## Review Guidance

- Verify recovery flow does not fabricate successful reattachment on failure.
- Verify normalized error structure consistency across endpoints/events.
- Verify audit exports are deterministic and complete for tested scenarios.

## Activity Log

- 2026-02-26T13:19:35Z – system – lane=planned – Prompt created.
- 2026-02-26T16:53:09Z – unknown – shell_pid=94640 – lane=for_review – Ready for review (forced lane move): recovery/watchdog/audit fidelity implemented in worktree commit 15af3c7.
- 2026-02-27T07:48:12Z – unknown – shell_pid=94640 – lane=for_review – Restacked, protocol asset parity closed; ready for review.
