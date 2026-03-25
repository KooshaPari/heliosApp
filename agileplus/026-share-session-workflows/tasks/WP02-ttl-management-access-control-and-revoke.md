---
work_package_id: WP02
title: TTL Management, Access Control, and Revoke
lane: "planned"
dependencies:
- WP01
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 1 - Lifecycle Management
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

# Work Package Prompt: WP02 - TTL Management, Access Control, and Revoke

## Objectives & Success Criteria

- Implement TTL tracking with configurable default, per-request override, and monotonic clock-based expiry.
- Deliver grace period warnings before TTL expiry with operator and participant notification.
- Implement auto-terminate on TTL expiry and TTL extension via explicit operator action.
- Enforce configurable concurrent share limit per terminal.
- Deliver revoke controls that disconnect participants within 5 seconds.

Success criteria:
- TTL expiry auto-terminates share sessions in 100% of lifecycle tests (SC-026-002).
- Grace warning fires at configured threshold before expiry.
- TTL extension updates expiry and records audit event.
- Concurrent share limit is enforced; exceeding returns clear error.
- Revoke disconnects participants within 5 seconds (NFR-026-003).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/026-share-session-workflows/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/026-share-session-workflows/spec.md`
- WP01 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-session.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-worker.ts`

Constraints:
- TTL tracking uses monotonic clock (not wall clock) to avoid drift.
- Revoke-to-disconnect < 5s (p95).
- Share worker memory < 15 MB per active share.
- Coverage >=85% with FR-026-003 through FR-026-007 traceability.

Implementation command:
- `spec-kitty implement WP02`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement TTL manager with configurable default and per-request override

- Purpose: Track share session time-to-live with reliable expiry detection.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/ttl-manager.ts`.
  2. Implement `TTLManager` class:
     - `register(sessionId: string, ttlMs: number): void` -- register a session with TTL.
     - `extend(sessionId: string, additionalMs: number): void` -- extend TTL; reject if already expired.
     - `getTimeRemaining(sessionId: string): number` -- milliseconds until expiry.
     - `isExpired(sessionId: string): boolean`.
     - `onExpiry(sessionId: string, callback: () => void): void` -- register expiry callback.
     - `onGrace(sessionId: string, callback: () => void): void` -- register grace period callback.
  3. Use `performance.now()` (monotonic clock) for all timing, not `Date.now()`.
  4. Define configurable defaults:
     - `defaultTtlMs: number` (default 1800000 = 30 minutes).
     - `gracePeriodMs: number` (default 300000 = 5 minutes before expiry).
     - `minTtlMs: number` (default 60000 = 1 minute).
     - `maxTtlMs: number` (default 14400000 = 4 hours).
  5. Implement timer management:
     - Use `setTimeout` for grace and expiry callbacks.
     - Clear and reset timers on TTL extension.
     - Clear timers on session termination (no stale timer fires).
  6. Emit bus events: `share.ttl.grace`, `share.ttl.expired`, `share.ttl.extended`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/ttl-manager.ts`
- Validation:
  - TTL expiry fires at correct time within 100ms tolerance.
  - Grace period fires at correct time before expiry.
  - Extension updates expiry and resets timers.
  - Expired sessions reject extension with clear error.
  - No stale timers fire after session termination.
- Parallel: No.

### Subtask T007 - Implement grace period warnings with operator and participant notification

- Purpose: Warn operators and participants before share sessions expire.
- Steps:
  1. In `ttl-manager.ts`, wire grace period callback to notification system:
     - Publish `share.ttl.grace` bus event with session ID, terminal ID, time remaining.
     - Notification payload includes: session ID, terminal name, expiry time, extension instructions.
  2. Implement notification delivery:
     - Operator notification: bus event consumed by UI layer (badge or toast).
     - Participant notification: send message through the share backend (upterm/tmate support in-session messaging or use a side channel).
  3. Grace period should be configurable per session (override default).
  4. If TTL is shorter than grace period, fire grace immediately on session start.
  5. If TTL is extended past grace threshold, cancel pending grace notification and reschedule.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/ttl-manager.ts`
- Validation:
  - Grace notification fires at correct time.
  - Both operator and participant receive notification.
  - Extension past grace threshold cancels and reschedules grace.
  - Short TTL triggers immediate grace.
- Parallel: No.

### Subtask T008 - Implement auto-terminate on TTL expiry and TTL extension

- Purpose: Ensure no share session outlives its TTL without explicit renewal.
- Steps:
  1. In `ttl-manager.ts`, wire expiry callback to `ShareSessionManager.terminate()`:
     - On expiry: call terminate, transition state to `expired`.
     - Publish `share.ttl.expired` bus event with session ID and terminal ID.
     - Disconnect all participants via the share backend adapter's stop method.
  2. Implement TTL extension in `ShareSessionManager`:
     - `extend(sessionId: string, additionalMs: number): Promise<void>`.
     - Validate session is active (not expired/revoked).
     - Call `TTLManager.extend()`.
     - Publish `share.ttl.extended` bus event with new expiry and correlation ID.
     - Record audit event (spec 024) for extension action.
  3. Handle race condition: extension request arrives after expiry timer fires:
     - If session is already in `expired` state, reject extension with clear error.
     - Use a mutex/lock to serialize expiry and extension operations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/ttl-manager.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-session.ts`
- Validation:
  - Expired sessions are auto-terminated with bus event.
  - Extension updates expiry correctly.
  - Extension after expiry is rejected.
  - Race condition between expiry and extension is handled safely.
- Parallel: No.

### Subtask T009 - Implement concurrent share limit and revoke with sub-5-second disconnect

- Purpose: Enforce share limits and provide fast revocation.
- Steps:
  1. In `ShareSessionManager`, implement concurrent share limit per terminal:
     - `maxSharesPerTerminal: number` (configurable, default 3).
     - Before creating a new share, check active share count for the terminal.
     - If at limit, reject with clear error and current count.
  2. Implement revoke in `ShareSessionManager`:
     - `revoke(sessionId: string): Promise<void>`.
     - Send disconnect signal to share worker (SIGTERM + IPC disconnect message).
     - Worker must disconnect all participants and exit.
     - If worker does not exit within 3s, send SIGKILL.
     - Transition state to `revoked`.
     - Publish `share.session.revoked` bus event.
     - Measure and log disconnect latency.
  3. Implement revoke-all for terminal:
     - `revokeAllForTerminal(terminalId: string): Promise<void>`.
     - Revoke all active shares for a terminal (used on terminal close).
  4. Handle network partition scenario:
     - If worker heartbeat times out during revoke, force-kill worker.
     - Orphan cleanup ensures no workers survive after terminal close.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/share-session.ts`
- Validation:
  - Concurrent limit prevents exceeding configured max.
  - Revoke disconnects participants within 5s.
  - SIGKILL fallback works if worker does not respond to SIGTERM.
  - Terminal close revokes all shares.
  - Disconnect latency is measured and logged.
- Parallel: No.

### Subtask T010 - Add unit and integration tests for TTL, grace, revoke, and concurrent limits

- Purpose: Verify all TTL lifecycle and access control behaviors.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/ttl-manager.test.ts`.
  2. TTL tests:
     - Test expiry fires at correct time (use fake timers).
     - Test grace period fires before expiry.
     - Test extension resets timers correctly.
     - Test expired session rejects extension.
     - Test session termination clears timers (no stale fires).
     - Test minimum and maximum TTL enforcement.
  3. Revoke tests:
     - Test revoke disconnects within 5s (measure elapsed time).
     - Test SIGKILL fallback when worker does not respond.
     - Test revoke-all for terminal.
     - Test revoke of already-revoked session (idempotent).
  4. Concurrent limit tests:
     - Test creating shares up to limit succeeds.
     - Test exceeding limit returns clear error.
     - Test revoking a share frees a slot for new share.
  5. Integration tests:
     - Full lifecycle: create share -> grace warning -> extend -> new grace -> expiry -> auto-terminate.
     - Create share -> revoke -> verify disconnect latency.
     - Create max shares -> revoke one -> create one more.
  6. Map tests to requirements:
     - FR-026-003 (TTL): TTL tests.
     - FR-026-004 (auto-terminate): expiry tests.
     - FR-026-005 (extension): extension tests.
     - FR-026-006 (concurrent limit): limit tests.
     - FR-026-007 (revoke): revoke tests.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/ttl-manager.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/sharing/__tests__/revoke.test.ts`
- Validation:
  - All tests pass.
  - Coverage >=85% on ttl-manager.ts and share-session.ts revoke paths.
  - Each mapped FR has at least one test.
- Parallel: Yes (after T006-T009 are stable).

## Test Strategy

- Use Vitest fake timers for TTL timing tests.
- Use real child processes with mock workers for revoke timing tests.
- Bus events captured via test spy for event verification.
- Concurrent limit tests use sequential create calls with assertions between.

## Risks & Mitigations

- Risk: Timer precision causes flaky TTL tests.
- Mitigation: Use fake timers with explicit advance; real-time tests use generous tolerance.
- Risk: Revoke latency exceeds 5s on slow systems.
- Mitigation: Reduce SIGTERM wait to 2s before SIGKILL in tests; log actual latency for SLO tracking.

## Review Guidance

- Confirm TTL uses monotonic clock, not wall clock.
- Confirm grace period is configurable and fires correctly relative to expiry.
- Confirm extension-after-expiry race condition is handled.
- Confirm revoke disconnects within 5s with SIGKILL fallback.
- Confirm concurrent limit is per-terminal, not per-workspace.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
