---
work_package_id: WP03
title: Handoff Workflows, Share UI, and Tests
lane: "planned"
dependencies:
- WP01
- WP02
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
phase: Phase 2 - Handoff and Hardening
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

# Work Package Prompt: WP03 - Handoff Workflows, Share UI, and Tests

## Objectives & Success Criteria

- Implement human-to-AI and AI-to-human terminal handoff stub (slice-1) with approval chain integration.
- Deliver share status badges in the lane panel reflecting active shares in real-time.
- Emit audit events for every share action (start, stop, extend, revoke, handoff) via spec 024.
- Deliver comprehensive integration tests and chaos tests for the complete share workflow.

Success criteria:
- Handoff stub triggers approval chain and preserves working directory and environment context (SC-026-003).
- Share badges update in real-time as shares are created, extended, and revoked.
- Every share action produces a correlated audit event (SC-026-005).
- No orphan share workers remain after revocation or terminal close (SC-026-004).
- Share worker crash does not affect host terminal PTY.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/026-share-session-workflows/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/026-share-session-workflows/spec.md`
- WP01-WP02 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-session.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-worker.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/ttl-manager.ts`
- Audit subsystem (spec 024):
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/`

Constraints:
- Handoff is slice-1 stub; full context transfer via zmx deferred to slice-2.
- Audit events must include correlation IDs.
- Share badges must be reactive to bus events.
- Coverage >=85% with FR-026-008, FR-026-010, FR-026-011 traceability.

Implementation command:
- `spec-kitty implement WP03`

## Subtasks & Detailed Guidance

### Subtask T011 - Implement handoff stub with approval chain and context preservation

- Purpose: Enable human-AI terminal handoff with policy-gated approval (slice-1 stub).
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/handoff.ts`.
  2. Define `HandoffRequest` type:
     - `fromType: 'human' | 'ai'`, `toType: 'human' | 'ai'`.
     - `terminalId: string`, `sessionId: string`.
     - `context: HandoffContext` -- working directory, environment variables, scrollback reference.
     - `correlationId: string`.
  3. Define `HandoffContext` type:
     - `workingDirectory: string`, `environmentVariables: Record<string, string>`, `scrollbackRef?: string`.
  4. Implement `HandoffManager` class:
     - `requestHandoff(request: HandoffRequest): Promise<HandoffResult>`:
       - Trigger approval chain via policy gate (spec 023).
       - If approved: capture current terminal context (cwd, env vars from zellij session).
       - Package context into `HandoffContext`.
       - Publish `share.handoff.initiated` bus event.
       - Return `HandoffResult` with context and approval status.
       - If denied: publish `share.handoff.denied` bus event, return denial reason.
     - `completeHandoff(handoffId: string): Promise<void>`:
       - Mark handoff as complete.
       - Publish `share.handoff.completed` bus event.
  5. Mark slice-2 TODOs explicitly:
     - Full process state transfer via zmx.
     - Scrollback transfer beyond reference.
     - Agent capability negotiation.
  6. Implement notification for both parties:
     - Human-to-AI: notify AI agent via bus event.
     - AI-to-human: notify human via UI notification (bus event consumed by UI).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/handoff.ts`
- Validation:
  - Handoff request triggers approval chain.
  - Approved handoff captures cwd and env vars.
  - Denied handoff returns reason without context transfer.
  - Bus events emitted for initiated, completed, and denied.
  - Slice-2 TODOs are explicit.
- Parallel: No.

### Subtask T012 - Implement share status badges in lane panel

- Purpose: Give operators real-time visibility into active share sessions.
- Steps:
  1. Determine UI integration point in `apps/desktop/src/` for lane panel badges.
  2. Implement `ShareBadgeState` reactive store:
     - Subscribe to bus events: `share.session.created`, `share.session.terminated`, `share.ttl.extended`, `share.session.revoked`, `share.handoff.initiated`.
     - Maintain per-terminal badge state: `{ terminalId, activeShares: number, sharingBackend: string, expiresAt: Date }`.
     - Update badge on each relevant bus event.
  3. Render badge in lane panel:
     - Active share: show share icon with backend name and time remaining.
     - Expiring soon (within grace period): show warning color.
     - No active shares: hide badge.
  4. Badge click action: show share session details (link, TTL, participants).
  5. Ensure badge updates are debounced to avoid UI flickering on rapid events.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/desktop/src/` (appropriate component file)
- Validation:
  - Badge appears when share is active.
  - Badge updates on extend, revoke, and expiry.
  - Badge shows warning color during grace period.
  - Badge disappears when no active shares.
  - No flickering on rapid events.
- Parallel: No.

### Subtask T013 - Implement audit event emission for all share actions

- Purpose: Ensure complete audit trail for every share action per spec 024.
- Steps:
  1. Define share audit event types:
     - `share.audit.started`: session ID, terminal ID, backend, TTL, operator, correlation ID.
     - `share.audit.stopped`: session ID, reason (expired/revoked/terminated), duration, correlation ID.
     - `share.audit.extended`: session ID, old expiry, new expiry, correlation ID.
     - `share.audit.revoked`: session ID, revoking operator, disconnect count, correlation ID.
     - `share.audit.handoff.initiated`: session ID, from type, to type, correlation ID.
     - `share.audit.handoff.completed`: session ID, correlation ID.
     - `share.audit.handoff.denied`: session ID, denial reason, correlation ID.
  2. Wire audit event emission into existing share lifecycle code:
     - `ShareSessionManager.create()` -> `share.audit.started`.
     - `ShareSessionManager.terminate()` -> `share.audit.stopped`.
     - `ShareSessionManager.extend()` -> `share.audit.extended`.
     - `ShareSessionManager.revoke()` -> `share.audit.revoked`.
     - `HandoffManager.requestHandoff()` -> `share.audit.handoff.initiated` or `denied`.
     - `HandoffManager.completeHandoff()` -> `share.audit.handoff.completed`.
  3. All audit events must pass through the audit sink (spec 024) with redaction (spec 028).
  4. Include correlation IDs linking to the originating share session in every event.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-session.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/handoff.ts`
- Validation:
  - Every share lifecycle action produces an audit event.
  - Audit events include required fields and correlation IDs.
  - Events pass through audit sink for persistence.
- Parallel: No.

### Subtask T014 - Add integration tests for handoff, badges, audit, and orphan cleanup

- Purpose: Verify end-to-end share workflow correctness.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/integration.test.ts`.
  2. **Handoff tests** (SC-026-003):
     - Human-to-AI handoff: verify approval chain, context capture (cwd, env), bus events.
     - AI-to-human handoff: verify notification, scrollback intact.
     - Denied handoff: verify no context transfer, denial notification.
  3. **Badge tests**:
     - Create share -> badge appears.
     - Extend share -> badge updates expiry.
     - Revoke share -> badge disappears.
     - Grace period -> badge shows warning.
  4. **Audit completeness tests** (SC-026-005):
     - Run full lifecycle: create -> extend -> revoke.
     - Verify every action produced a correlated audit event.
     - Verify audit events contain required fields.
  5. **Orphan cleanup tests** (SC-026-004):
     - Create share, close terminal -> verify worker is terminated.
     - Create share, crash worker -> verify cleanup occurs.
     - Create multiple shares, revoke all -> verify zero orphan processes.
  6. Map tests to success criteria SC-026-001 through SC-026-005.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/integration.test.ts`
- Validation:
  - All test scenarios pass.
  - Each SC-026-* has at least one mapped test.
  - Coverage across all sharing files >=85%.
- Parallel: Yes (after T011-T013 are stable).

### Subtask T015 - Add chaos tests for share worker crash isolation and heartbeat cleanup

- Purpose: Prove share worker failures do not affect host terminal or leave orphans.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/chaos.test.ts`.
  2. **Worker crash isolation** (SC-026-004, NFR-026-004):
     - Start share, kill worker process with SIGKILL.
     - Verify: host terminal PTY remains functional.
     - Verify: share session transitions to failed state.
     - Verify: audit event records the failure.
     - Verify: no orphan processes.
  3. **Heartbeat timeout cleanup**:
     - Start share, block worker heartbeat (simulate hang).
     - Verify: heartbeat timeout triggers worker kill.
     - Verify: session transitions to failed.
     - Verify: cleanup completes within 10s.
  4. **Concurrent crash resilience**:
     - Start 3 shares on different terminals.
     - Kill 2 of 3 workers simultaneously.
     - Verify: surviving share remains functional.
     - Verify: failed shares are cleaned up.
     - Verify: zero orphan processes.
  5. Run each scenario 5+ times for reliability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/chaos.test.ts`
- Validation:
  - 100% isolation in all chaos scenarios across multiple runs.
  - Zero orphan processes after every test.
  - Host terminal PTY always remains functional.
- Parallel: Yes (after T011-T013 are stable).

## Test Strategy

- Handoff tests use mock policy gate and mock terminal context.
- Badge tests use bus event injection and UI state assertions.
- Audit tests capture events via spy on audit sink.
- Chaos tests use real child processes with forced kills.
- All tests run via Bun/Vitest.

## Risks & Mitigations

- Risk: Handoff context capture is incomplete in slice-1.
- Mitigation: Explicit slice-2 TODOs for full state transfer; slice-1 captures cwd and env only.
- Risk: Audit event volume impacts test performance.
- Mitigation: Test assertions are targeted; batch verification where possible.

## Review Guidance

- Confirm handoff stub has explicit slice-2 TODOs for deferred features.
- Confirm share badges are reactive and debounced.
- Confirm every share action produces an audit event with correlation ID.
- Confirm chaos tests achieve 100% isolation across multiple runs.
- Confirm no orphan workers after any failure scenario.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
