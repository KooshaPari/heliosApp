# Test Coverage Matrix

**Project**: heliosApp  
**Document Version**: 1.1  
**Last Updated**: 2026-06-05

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Functional Requirements | 283 cataloged in `FUNCTIONAL_REQUIREMENTS.md` |
| Representative FR/UJ Pairs Mapped | 5 |
| Test Files | 239 discovered `*.test.ts` / `*.spec.ts` files |
| Test Functions | Not recalculated in this minimal retry |
| Coverage Target | 80% |
| Current Coverage | Not recalculated in this minimal retry |

---

## Test Categories

### Unit Tests
- **Location**: `apps/**/__tests__/`, `apps/**/tests/unit/`, `packages/**/tests/`, `scripts/tests/`
- **Purpose**: Test individual components in isolation
- **Coverage Target**: 90%

### Integration Tests
- **Location**: `apps/runtime/tests/integration/` and integration-style runtime source tests
- **Purpose**: Test component interactions
- **Coverage Target**: 75%

---

## FR to Test Coverage Mapping

| FR ID | User Journey | Description | Test Files | Coverage Status |
|-------|--------------|-------------|------------|-----------------|
| FR-LAN-001 | UJ-3 Task and Project Management Workflow | Lane orchestration state machine supports project/task execution isolation via `new -> provisioning -> ready -> running -> blocked -> shared -> cleaning -> closed`. | `apps/runtime/tests/lanes/state_machine.test.ts` | Covered by representative unit tests |
| FR-PTY-001 | UJ-3 Task and Project Management Workflow | PTY lifecycle state machine validates terminal process progression for active project/task work. | `apps/runtime/src/pty/__tests__/state_machine.test.ts` | Covered by representative unit tests |
| FR-CRH-002 | UJ-1 New User Onboarding and Profile Setup | Recovery state machine restores application state after abnormal termination so onboarding/session work can resume. | `apps/runtime/src/recovery/__tests__/state-machine.test.ts` | Covered by representative unit tests |
| FR-CRH-003 / FR-CRH-004 | UJ-1 New User Onboarding and Profile Setup | Checkpoints and integrity validation preserve terminal/session state across restore. | `apps/runtime/src/recovery/__tests__/checkpoint.test.ts` | Covered by representative unit tests |
| FR-ORF-001 | UJ-4 Collaboration and Team Features | Watchdog/orphan detection identifies stale lane/worktree resources in shared multi-agent collaboration contexts. | `apps/runtime/src/recovery/__tests__/watchdog.test.ts` | Covered by representative unit tests |

---

## Journey Evidence Stubs

| Journey | Evidence Artifact | Status |
|---------|-------------------|--------|
| UJ-3 Task and Project Management Workflow | `docs/journeys/manifests/uj-3-task-project-management.stub.md` | RICH-MEDIA-STUB pending real capture |

---

## Coverage Gaps

### Critical Gaps
1. Full 283-requirement matrix remains unexpanded; this retry only maps five representative FR/UJ pairs.
2. Current aggregate line coverage was not recalculated in this minimal pass.
3. Rich-media journey evidence is stubbed only; no keyframes or recordings are attached yet.

### Partial Coverage
1. UJ-1 maps to crash recovery and checkpoint behavior, not the complete onboarding UI flow.
2. UJ-3 maps to lane/PTTY runtime behavior, not complete end-user task/project UI flows.
3. UJ-4 maps to orphan/resource detection for shared lanes, not invitation or member-management flows.

---

## Recommendations

### Immediate Actions
1. Expand this matrix incrementally by category, starting with `FR-MVP-*`, `FR-SHL-*`, and `FR-CI-*`.
2. Attach real journey evidence artifacts for UJ-3 once the desktop shell flow is runnable under local capture tooling.

### Short-term Actions
1. Recalculate aggregate coverage with `bun run test:coverage` after the full matrix is populated.
2. Add direct UJ-level tests or Playwright scenarios for onboarding, lane creation, recovery, and collaboration flows.

---

**Last Updated**: 2026-06-05
