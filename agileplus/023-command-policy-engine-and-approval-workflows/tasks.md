# Work Packages: Command Policy Engine and Approval Workflows

**Inputs**: Design documents from `/kitty-specs/023-command-policy-engine-and-approval-workflows/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because policy enforcement is security-critical and requires chaos testing.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/023-command-policy-engine-and-approval-workflows/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/runtime/`, `apps/desktop/`, and `kitty-specs/`.

---

## Work Package WP01: Policy Rule Model and Storage (Priority: P0)

**Phase**: Phase 1 - Policy Foundation
**Goal**: Define the policy rule model with glob/regex pattern matching, classification (safe/needs-approval/blocked), workspace scoping, and denylist-wins conflict resolution. Store rules with hot-swap support.
**Independent Test**: Create a rule set, classify commands against it, verify safe commands pass, blocked commands are rejected, and denylist overrides allowlist.
**Prompt**: `/kitty-specs/023-command-policy-engine-and-approval-workflows/tasks/WP01-policy-rule-model-and-storage.md`
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [ ] T001 Define `PolicyRule` type: pattern (glob/regex), classification (safe/needs-approval/blocked), scope (workspace ID), priority, and description
- [ ] T002 Implement `PolicyRuleSet` with ordered evaluation, denylist-wins conflict resolution, and deny-by-default for unmatched commands
- [ ] T003 Implement rule storage with in-memory hot cache and file-backed persistence for durability
- [ ] T004 Implement hot-swap rule updates: policy changes take effect within 1 second without process restart (NFR-023-003)
- [ ] T005 [P] Add unit tests for rule matching, classification, conflict resolution (denylist-wins), deny-by-default, and hot-swap update propagation

### Implementation Notes
- Deny-by-default is non-negotiable: unclassified commands must never execute.
- Denylist patterns always override allowlist patterns for the same command.
- Policy evaluation must be < 50ms (p95) for up to 500 rules.

### Parallel Opportunities
- T005 can proceed after T001-T004 interfaces are defined.

### Dependencies
- None (self-contained policy foundation).

### Risks & Mitigations
- Risk: Complex regex patterns cause evaluation to exceed 50ms.
- Mitigation: Benchmark pattern matching; limit regex complexity or pre-compile patterns.

---

## Work Package WP02: Policy Evaluation Engine and Deny-by-Default (Priority: P0)

**Goal**: Implement the evaluation engine that intercepts every agent-mediated command, matches it against workspace-scoped rules, and produces a classification decision. Integrate with the local bus for event publishing and the audit sink for recording.
**Independent Test**: Issue 1000 randomized unclassified commands and verify 100% are denied; issue classified safe commands and verify immediate execution; verify audit trail completeness.
**Prompt**: `/kitty-specs/023-command-policy-engine-and-approval-workflows/tasks/WP02-policy-evaluation-engine.md`
**Estimated Prompt Size**: ~340 lines

### Included Subtasks
- [ ] T006 Implement `PolicyEvaluationEngine` that accepts command context (command text, workspace ID, agent ID, affected paths) and returns classification + matched rule
- [ ] T007 Integrate policy evaluation into lane execution pipeline (spec 008) as a pre-execution hook
- [ ] T008 Integrate policy evaluation into terminal command dispatch as a pre-execution hook
- [ ] T009 Wire every evaluation result to the audit sink (spec 024) with PolicyEvaluationResult record
- [ ] T010 [P] Add deny-by-default verification: 1000 randomized unclassified commands, all denied; benchmarked evaluation latency < 50ms p95

### Implementation Notes
- The engine must be synchronous or have bounded async latency (< 50ms).
- Operator commands (direct terminal input) bypass approval but still audit-log.
- Integration must not block agent execution for safe commands.

### Parallel Opportunities
- T010 can proceed after T006 engine is functional.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: Policy evaluation adds latency to the agent execution hot path.
- Mitigation: Pre-compiled patterns; in-memory rule cache; benchmark in CI.

---

## Work Package WP03: Approval Request Lifecycle, Queue UI, and Tests (Priority: P1)

**Goal**: Deliver the approval request lifecycle (create, queue, approve/deny/timeout), durable queue backed by SQLite surviving restart, and the approval queue UI panel. Comprehensive tests including chaos tests for queue durability.
**Independent Test**: Create an approval request, restart the app, verify the request survives; approve it, verify the command executes within 500ms.
**Prompt**: `/kitty-specs/023-command-policy-engine-and-approval-workflows/tasks/WP03-approval-lifecycle-queue-ui.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T011 Implement `ApprovalRequest` model: command text, affected paths, risk classification, agent rationale, status (pending/approved/denied/timed-out), timestamps
- [ ] T012 Implement durable `ApprovalQueue` backed by SQLite: persist pending requests, survive restart, support concurrent requests from multiple lanes
- [ ] T013 Implement approval actions: approve (with operator reason), deny (with reason), timeout (configurable, default action = deny)
- [ ] T014 Implement approval queue UI panel in `apps/desktop/src/panels/approval-queue.ts` showing pending requests with context and approve/deny controls
- [ ] T015 Wire approved commands to immediate execution (< 500ms from approval to execution)
- [ ] T016 [P] Add chaos tests: simulated crash during pending approval, verify queue recovers with zero request loss
- [ ] T017 [P] Add integration tests: full approval round-trip (request -> approve -> execute), denial flow, timeout flow, concurrent requests, audit trail completeness

### Implementation Notes
- Queue must support at least 100 concurrent pending requests (NFR-023-002).
- Timeout default action is deny; configurable per workspace.
- Approval UI must show: command text, affected paths, risk level, agent rationale, time remaining.

### Parallel Opportunities
- T016 and T017 can proceed after T011-T015 are functional.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: SQLite write contention under concurrent approval requests.
- Mitigation: Use WAL mode; batch writes; benchmark concurrent access.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03.
- **Parallelization**: Within each WP, test subtasks can run after core implementations.
- **MVP Scope**: All three WPs required for policy enforcement per constitution.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | PolicyRule type definition | WP01 | P0 | No |
| T002 | PolicyRuleSet with denylist-wins | WP01 | P0 | No |
| T003 | Rule storage (memory + file) | WP01 | P0 | No |
| T004 | Hot-swap rule updates | WP01 | P0 | No |
| T005 | Rule model unit tests | WP01 | P0 | Yes |
| T006 | PolicyEvaluationEngine | WP02 | P0 | No |
| T007 | Lane execution integration | WP02 | P0 | No |
| T008 | Terminal dispatch integration | WP02 | P0 | No |
| T009 | Audit sink integration | WP02 | P0 | No |
| T010 | Deny-by-default + perf tests | WP02 | P0 | Yes |
| T011 | ApprovalRequest model | WP03 | P1 | No |
| T012 | Durable SQLite ApprovalQueue | WP03 | P1 | No |
| T013 | Approve/deny/timeout actions | WP03 | P1 | No |
| T014 | Approval queue UI panel | WP03 | P1 | No |
| T015 | Approved command execution wiring | WP03 | P1 | No |
| T016 | Queue durability chaos tests | WP03 | P1 | Yes |
| T017 | Approval lifecycle integration tests | WP03 | P1 | Yes |
