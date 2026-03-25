# Feature Specification: Command Policy Engine and Approval Workflows

**Feature Branch**: `023-command-policy-engine-and-approval-workflows`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Policy engine that evaluates every agent-mediated command against workspace-scoped rules before execution. Commands are classified as safe, needs-approval, or blocked. When approval is required, the engine creates a request with rationale and context, queues it for operator review, and blocks execution until resolved or timed out. Deny-by-default for unclassified commands. Every evaluation is recorded in the audit trail (spec 024).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Safe Command Executes Without Interruption (Priority: P0)

As an operator, I want commands classified as safe to execute immediately so that agent workflows are not bottlenecked by unnecessary approvals.

**Why this priority**: Most commands are safe; friction here kills the product.

**Acceptance Scenarios**:

1. **Given** a workspace with a policy allowing `git status`, **When** an agent issues `git status`, **Then** the command executes immediately with no approval prompt and an audit entry is recorded.
2. **Given** a command matching multiple rules, **When** evaluated, **Then** the most restrictive rule wins.
3. **Given** the policy engine is temporarily unreachable, **When** a command is issued, **Then** execution blocks (deny-by-default) and the operator is notified.

---

### User Story 2 — Approval Request for Sensitive Commands (Priority: P0)

As an operator, I want to review and approve agent commands that touch sensitive paths or run destructive operations before they execute.

**Why this priority**: Constitution mandates policy gates before agent execution.

**Acceptance Scenarios**:

1. **Given** an agent requests `rm -rf ./src`, **When** policy classifies it as needs-approval, **Then** an approval request appears in the queue with command text, affected paths, risk level, and agent rationale.
2. **Given** a pending approval, **When** the operator approves, **Then** the command executes within 500ms and the approval is recorded.
3. **Given** a pending approval, **When** the operator denies, **Then** the agent receives a denial with the operator's reason and no execution occurs.
4. **Given** a pending approval, **When** the timeout expires, **Then** the configurable default action (deny or approve) is applied and logged.

---

### User Story 3 — Policy Management (Priority: P1)

As an operator, I can define and update policy rules per workspace so that different projects have different trust boundaries.

**Acceptance Scenarios**:

1. **Given** a workspace, **When** the operator adds a denylist pattern for `*.env`, **Then** any agent command targeting `.env` files is blocked.
2. **Given** a policy update, **When** applied, **Then** it takes effect for the next command evaluation without requiring restart.
3. **Given** conflicting allowlist and denylist entries, **When** evaluated, **Then** denylist takes precedence.

---

### Edge Cases

- Approval queue must persist across app restart; pending requests survive crash/relaunch.
- Concurrent approval requests from multiple lanes must not deadlock the queue.
- Policy evaluation must complete within 50ms to avoid blocking the agent execution hot path.
- Commands issued outside agent context (direct operator input) bypass approval but still log to audit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-023-001**: The system MUST evaluate every agent-mediated command against workspace-scoped policy rules before execution.
- **FR-023-002**: The system MUST classify commands as safe, needs-approval, or blocked using allowlist/denylist pattern matching.
- **FR-023-003**: The system MUST deny-by-default any command that matches no policy rule.
- **FR-023-004**: The system MUST create approval requests containing command text, affected files, risk classification, agent rationale, and diff context.
- **FR-023-005**: The system MUST support approve and deny actions on pending requests with operator-supplied reason.
- **FR-023-006**: The system MUST enforce configurable timeouts on approval requests with a default action (deny).
- **FR-023-007**: The system MUST persist the approval queue durably so pending requests survive restart.
- **FR-023-008**: The system MUST protect sensitive path patterns (credentials, env files, config) with denylist rules that override allowlist.
- **FR-023-009**: The system MUST provide an approval queue UI panel showing pending requests with context and approve/deny controls.
- **FR-023-010**: The system MUST record every policy evaluation result to the audit log (spec 024).
- **FR-023-011**: The system MUST integrate policy checks into lane execution (par) and terminal command dispatch.

### Non-Functional Requirements

- **NFR-023-001**: Policy evaluation latency MUST be < 50ms (p95) for rule sets up to 500 rules.
- **NFR-023-002**: Approval queue MUST support at least 100 concurrent pending requests without degradation.
- **NFR-023-003**: Policy rule updates MUST take effect within 1 second without process restart.

### Dependencies

- **Spec 002** (Local Bus): Policy evaluation events and approval lifecycle published on the bus.
- **Spec 008** (Lane Execution): Policy check hooks integrated into par execution pipeline.
- **Spec 024** (Audit Logging): Every evaluation result written to audit sink.

## Key Entities

- **PolicyRule**: Pattern-based rule (glob or regex) with classification (safe/needs-approval/blocked), scope (workspace), and priority.
- **PolicyRuleSet**: Ordered collection of rules for a workspace, with denylist-wins conflict resolution.
- **ApprovalRequest**: Pending request linking a command, its policy match, context (diff, rationale, risk), status (pending/approved/denied/timed-out), and timestamps.
- **ApprovalQueue**: Durable ordered collection of pending ApprovalRequests with persistence and bus notifications.
- **PolicyEvaluationResult**: Immutable record of rule matched, classification, decision, and timing for audit.

## Success Criteria *(mandatory)*

- **SC-023-001**: 100% of agent-mediated commands are evaluated against policy before execution in integration tests.
- **SC-023-002**: Deny-by-default verified: unclassified commands never execute across 1000 randomized command inputs.
- **SC-023-003**: Approval round-trip (request creation to command execution after approve) completes in < 500ms excluding operator decision time.
- **SC-023-004**: Approval queue survives simulated crash and restart with zero request loss in 100% of chaos test runs.
- **SC-023-005**: Audit trail contains a record for every policy evaluation with no gaps over a 24-hour soak test.

## Assumptions

- Operators are the sole approval authority; no multi-party or delegated approval in initial scope.
- Policy rules are workspace-scoped; global default rules are a post-MVP extension.
- Direct operator commands in terminal bypass approval but are still audit-logged.
- Approval UI is integrated into the shell sidebar; no external approval channels in initial scope.
