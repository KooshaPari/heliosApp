# Implementation Plan: Command Policy Engine and Approval Workflows

**Branch**: `023-command-policy-engine-and-approval-workflows` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/023-command-policy-engine-and-approval-workflows/spec.md`

## Summary

Build a policy engine that evaluates every agent-mediated command against workspace-scoped allowlist/denylist rules before execution. Commands are classified as safe, needs-approval, or blocked. Deny-by-default for unclassified commands. Approval requests queue for operator review with full context (command, paths, risk, rationale). The approval queue is durable across restarts. Every evaluation is recorded to the audit trail (spec 024).

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - PolicyRule model with glob/regex pattern matching and safe/needs-approval/blocked classification.
  - PolicyRuleSet with ordered evaluation and denylist-wins conflict resolution.
  - Deny-by-default for unmatched commands.
  - Approval request lifecycle: create, queue, approve/deny/timeout.
  - Durable approval queue (SQLite-backed) surviving restart.
  - Integration with lane execution pipeline (spec 008) and audit log (spec 024).
  - Approval queue UI panel in shell sidebar.
- **Slice-2 (deferred)**:
  - Global default rules (cross-workspace).
  - Multi-party or delegated approval chains.
  - Policy rule analytics and recommendation engine.

## Technical Context

**Language/Version**: TypeScript 7, Bun >= 1.2
**Primary Dependencies**: Local bus (spec 002), lane execution (spec 008), audit sink (spec 024)
**Storage**: SQLite for durable approval queue; in-memory for hot policy evaluation
**Testing**: Vitest for rule evaluation logic, chaos tests for queue durability, integration tests for lane hookup
**Target Platform**: Local device-first runtime (`apps/runtime`)
**Performance Goals**: Policy evaluation < 50ms (p95) for up to 500 rules; approval round-trip < 500ms
**Constraints**: Deny-by-default; denylist overrides allowlist; operator commands bypass approval but still audit-log

## Constitution Check

- **Security posture**: PASS. Deny-by-default; sensitive paths protected by denylist override.
- **Auditability**: PASS. Every evaluation recorded to spec 024 audit sink.
- **Local-first**: PASS. All policy evaluation and approval happens on-device.
- **Testing posture**: PASS. Chaos tests for queue durability; randomized input tests for deny-by-default.
- **Architecture discipline**: PASS. Clean separation of policy model, evaluation engine, and approval lifecycle.

## Project Structure

### Documentation (this feature)

```
kitty-specs/023-command-policy-engine-and-approval-workflows/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/policy/
├── engine.ts              # Policy evaluation engine
├── rules.ts               # PolicyRule and PolicyRuleSet models
├── approval.ts            # Approval request lifecycle
├── queue.ts               # Durable approval queue (SQLite-backed)
└── types.ts               # Shared policy types
apps/desktop/src/
└── panels/
    └── approval-queue.ts  # Approval queue UI panel
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| SQLite-backed durable queue instead of in-memory only | Pending approvals must survive crash/restart per FR-023-007 | In-memory queue loses pending requests on crash, blocking agent workflows |
| Denylist-wins conflict resolution | Constitution requires sensitive paths to be unconditionally protected | Allowlist-wins or last-match-wins creates security gaps for credential/env files |

## Quality Gate Enforcement

- 100% of agent-mediated commands must be evaluated against policy in integration tests.
- Deny-by-default verified across 1000 randomized unclassified command inputs.
- Approval queue survives simulated crash with zero request loss in chaos tests.
- Policy evaluation latency < 50ms (p95) benchmarked in CI.
- Audit trail completeness: every evaluation produces a corresponding audit event (verified via spec 024 integration).
- No `@ts-ignore` or suppression directives in policy engine code.
