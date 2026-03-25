# Work Packages: Share Session Workflows

**Inputs**: Design documents from `/kitty-specs/026-share-session-workflows/`
**Prerequisites**: plan.md (required), spec.md (user stories), related specs (002, 009, 023, 024)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/026-share-session-workflows/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Upterm Adapter and Tmate Adapter (Priority: P0 -- prerequisite to all other WPs)

**Phase**: Phase 0 - Foundation
**Goal**: Implement the upterm and tmate share backend adapters with on-demand worker lifecycle, backend selection, share link generation, and policy gate integration.
**Independent Test**: Share via upterm generates a link within 3s; share via tmate generates a link; switching backends terminates previous and starts new; policy denial blocks share worker start.
**Prompt**: `/kitty-specs/026-share-session-workflows/tasks/WP01-upterm-adapter-and-tmate-adapter.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T001 Implement share session entity and on-demand worker lifecycle in `apps/runtime/src/integrations/sharing/share-session.ts` and `share-worker.ts`
- [ ] T002 Implement upterm share backend adapter with link generation in `apps/runtime/src/integrations/sharing/upterm-adapter.ts`
- [ ] T003 Implement tmate share backend adapter with link generation in `apps/runtime/src/integrations/sharing/tmate-adapter.ts`
- [ ] T004 Integrate policy gate (spec 023) as deny-by-default pre-share hook
- [ ] T005 [P] Add unit tests for share session lifecycle, worker management, upterm adapter, tmate adapter, and policy gate integration

### Implementation Notes
- Share workers are on-demand processes; no background daemon per terminal.
- Worker crash must not affect the host terminal PTY.
- Backend selection happens at share time; switching backends terminates the previous session.

### Parallel Opportunities
- T005 can proceed after T001-T003 interfaces are stable.

### Dependencies
- None (foundation WP).

### Risks & Mitigations
- Risk: upterm/tmate binary availability varies across platforms.
- Mitigation: binary existence check on adapter init; clear error if missing.

---

## Work Package WP02: TTL Management, Access Control, and Revoke (Priority: P0)

**Goal**: Implement TTL tracking with grace period warnings, auto-terminate on expiry, TTL extension, concurrent share limits, and revoke with sub-5-second disconnect.
**Independent Test**: TTL expiry auto-terminates share; grace warning fires at configured threshold; revoke disconnects participants within 5s; concurrent limit is enforced.
**Prompt**: `/kitty-specs/026-share-session-workflows/tasks/WP02-ttl-management-access-control-and-revoke.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T006 Implement TTL manager with configurable default, per-request override, and expiry tracking in `apps/runtime/src/integrations/sharing/ttl-manager.ts`
- [ ] T007 Implement grace period warnings before TTL expiry with operator and participant notification
- [ ] T008 Implement auto-terminate on TTL expiry and TTL extension via operator action
- [ ] T009 Implement concurrent share limit enforcement and revoke with sub-5-second participant disconnect
- [ ] T010 [P] Add unit and integration tests for TTL lifecycle, grace warnings, auto-terminate, extension, concurrent limits, and revoke timing

### Implementation Notes
- TTL tracking should use monotonic clock to avoid wall-clock drift issues.
- Revoke must actively disconnect participants, not just stop accepting new connections.
- Concurrent share limit is per-terminal, not per-workspace.

### Parallel Opportunities
- T010 can proceed after T006-T009 interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: TTL expiry race with extension request.
- Mitigation: TTL extension acquires lock before checking expiry; extend-after-expiry returns clear error.

---

## Work Package WP03: Handoff Workflows, Share UI, and Tests (Priority: P1)

**Goal**: Implement human-to-AI and AI-to-human terminal handoff stub (slice-1), share status badges in the lane panel, audit event emission for all share actions, and comprehensive integration tests.
**Independent Test**: Handoff stub triggers approval chain and returns context; share badges reflect active shares; every share action produces audit event; no orphan workers after revocation or terminal close.
**Prompt**: `/kitty-specs/026-share-session-workflows/tasks/WP03-handoff-workflows-share-ui-and-tests.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T011 Implement human-to-AI and AI-to-human handoff stub with approval chain and context preservation in `apps/runtime/src/integrations/sharing/handoff.ts`
- [ ] T012 Implement share status badges in lane panel UI reflecting active shares
- [ ] T013 Implement audit event emission for all share actions (start, stop, extend, revoke, handoff) via spec 024
- [ ] T014 [P] Add integration tests for handoff workflow, share badge updates, audit event completeness, and orphan worker cleanup
- [ ] T015 [P] Add chaos tests for share worker crash isolation and heartbeat-timeout cleanup

### Implementation Notes
- Handoff is slice-1 stub; full context transfer deferred to zmx integration (slice-2).
- Audit events must include correlation IDs linking to the originating share session.
- Share badges must update in real-time as shares are created, extended, and revoked.

### Parallel Opportunities
- T014 and T015 can proceed after T011-T013 implementations are stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: Audit event volume for active shares creates performance overhead.
- Mitigation: Batch audit events where possible; keep per-event payload small.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 (adapters) + WP02 (TTL/revoke) deliver core sharing functionality; WP03 adds handoff stub, UI badges, audit, and comprehensive tests.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Share session entity and worker lifecycle | WP01 | P0 | No |
| T002 | Upterm share backend adapter | WP01 | P0 | No |
| T003 | Tmate share backend adapter | WP01 | P0 | No |
| T004 | Policy gate integration | WP01 | P0 | No |
| T005 | Share adapter unit tests | WP01 | P0 | Yes |
| T006 | TTL manager implementation | WP02 | P0 | No |
| T007 | Grace period warnings | WP02 | P0 | No |
| T008 | Auto-terminate and TTL extension | WP02 | P0 | No |
| T009 | Concurrent limits and revoke | WP02 | P0 | No |
| T010 | TTL/revoke integration tests | WP02 | P0 | Yes |
| T011 | Handoff stub with approval chain | WP03 | P1 | No |
| T012 | Share status badges in lane panel | WP03 | P1 | No |
| T013 | Audit event emission for share actions | WP03 | P1 | No |
| T014 | Handoff/badge/audit integration tests | WP03 | P1 | Yes |
| T015 | Share worker crash isolation chaos tests | WP03 | P1 | Yes |
