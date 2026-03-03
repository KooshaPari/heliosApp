# Lane Provider Wave 2026-03-03

Scope:
- 24-task child-agent provider wave tracking (6 lanes x 4 tasks).
- Lane F validation/evidence handoff artifact for parent integration.

Status key:
- `PASS`: output captured and reviewed.
- `FAIL`: command completed with non-zero/failing checks.
- `BLOCKED`: execution prevented by external dependency or environment.
- `PENDING`: not executed yet in this artifact.

## Lane Ownership

| Lane | Owner | Scope |
| --- | --- | --- |
| A | Child Agent A | Provider contracts and interfaces |
| B | Child Agent B | Provider adapters and error surfaces |
| C | Child Agent C | Provider protocol boundaries |
| D | Child Agent D | Provider tests and fixtures |
| E | Child Agent E | Provider docs and evidence collation |
| F | Child Agent F | Validation and integration handoff |

## Command Evidence Matrix (Parent Integration Ready)

| Command | Expected artifact/output path | Current status | Notes |
| --- | --- | --- | --- |
| `bunx oxlint apps/runtime/src/providers/__tests__/errors.test.ts apps/runtime/src/providers/__tests__/isolation.test.ts apps/runtime/src/providers/__tests__/adapter.test.ts apps/runtime/src/providers/__tests__/a2a-router.test.ts apps/runtime/src/providers/__tests__/acp-client.test.ts` | `artifacts/provider-wave-oxlint-provider-tests-20260303.txt` | `PENDING` | Prior evidence of warnings exists in `ci-summary-20260303-rerun7.txt`; rerun output not attached here yet. |
| `bunx oxlint apps/runtime/src/protocol/bus.ts apps/runtime/src/protocol/envelope.ts apps/runtime/src/protocol/validator.ts` | `artifacts/provider-wave-oxlint-protocol-20260303.txt` | `PENDING` | Prior warning references exist in `ci-summary-20260303-rerun3.txt` and `ci-summary-20260303-rerun4.txt`. |
| `bunx oxlint apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts` | `artifacts/provider-wave-oxlint-recovery-suppression-20260303.txt` | `PENDING` | Baseline showed `warnings=4` in `lane-c-recovery-baseline-matrix.md`. |
| `bun test apps/runtime/src/providers/__tests__/adapter.test.ts apps/runtime/src/providers/__tests__/errors.test.ts apps/runtime/src/providers/__tests__/isolation.test.ts apps/runtime/src/providers/__tests__/a2a-router.test.ts apps/runtime/src/providers/__tests__/acp-client.test.ts` | `artifacts/provider-wave-provider-tests-20260303.txt` | `PENDING` | Record pass/fail and failing test IDs if non-zero. |
| `task quality:quick` | `artifacts/provider-wave-quality-quick-20260303.txt` | `PENDING` | Use as parent integration snapshot after focused checks. |

## Lane Task Checklist (24)

### Lane A (Provider contracts and interfaces)
- [ ] Inventory provider contract entrypoints and map current call graph.
- [ ] Normalize contract typing across provider request/response boundaries.
- [ ] Update contract-focused tests for typed payload parity.
- [ ] Publish lane artifact with changed files and unresolved contract risks.

### Lane B (Provider adapters and error surfaces)
- [ ] Audit provider adapter implementations for lint/type hotspots.
- [ ] Refactor adapter error normalization for deterministic behavior.
- [ ] Update adapter regression tests for failure-class coverage.
- [ ] Publish lane artifact with warning deltas and residual adapter issues.

### Lane C (Provider protocol boundaries)
- [ ] Audit provider-to-protocol translation paths for naming-rule conflicts.
- [ ] Apply protocol-safe lint fixes without wire-format drift.
- [ ] Add targeted protocol boundary tests for provider message paths.
- [ ] Publish lane artifact with boundary compatibility notes.

### Lane D (Provider tests and fixtures)
- [ ] Consolidate provider test fixture setup for deterministic runs.
- [ ] Remove warning-prone test patterns in provider test files.
- [ ] Add focused provider isolation and routing assertions.
- [ ] Publish lane artifact with test command outputs and unresolved gaps.

### Lane E (Provider docs and evidence collation)
- [ ] Build provider-wave evidence index and map command-to-artifact outputs.
- [ ] Update session docs with provider-wave status and open risks.
- [ ] Generate checksum-ready manifest entries for new provider artifacts.
- [ ] Publish lane artifact bundle for parent integration.

### Lane F (Validation and integration handoff)
- [ ] Run focused provider lint/type/test validation commands.
- [ ] Capture command outputs in this artifact and linked files.
- [ ] Classify pass/fail/blocked per command with evidence links.
- [ ] Publish handoff-ready summary for parent integration decision.

## Parent Integration Placeholders

- Overall lane recommendation: `TBD`
- Blocking issues: `TBD`
- Evidence completeness: `TBD`
- Ready to merge to parent branch: `TBD`
