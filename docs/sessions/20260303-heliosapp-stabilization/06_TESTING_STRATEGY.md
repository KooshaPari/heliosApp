# Testing Strategy

## Testing Goals

- Confirm runtime stabilization changes are type/lint-safe.
- Validate targeted behavior through representative unit/integration tests.
- Verify devops push workflow and docs/session handoff readiness.

## Required Checks (Executed/required by WBS)

- `bunx biome check` (runtime touched modules)
- `bun run typecheck`
- `bun test apps/runtime/tests/unit/renderer/stream_binding.test.ts`
- `bun test apps/runtime/tests/integration/diagnostics/slo.test.ts`
- `task devops:check:ci-summary` (repeated during cleanup passes)
- `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src`
- `bun test apps/runtime/tests/integration/renderer/lifecycle.test.ts`
- `bun test apps/runtime/tests/integration/lanes/lifecycle.test.ts`

## Artifact Capture

- `docs/sessions/20260303-heliosapp-stabilization/artifacts/biome-runtime-src-20260303.txt`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/integration-renderer-lifecycle-20260303.txt`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/integration-lanes-lifecycle-20260303.txt`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303.txt`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_test_matrix.md`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_risks_and_known_issues.md`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-f-gate-matrix.md`
- `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-f-handoff.md`

## Test Results Snapshot

- `bunx biome check --diagnostic-level=warn apps/runtime/src` currently reports:
  - Warning-only hotspots remain in session/lifecycle-heavy areas, and these are outside blocking scope.
  - This pass intentionally captures warning debt as follow-up hardening tasks.
  - Both integration lifecycle suites pass after Phase 6 runtime fixes.

## Known Gaps

- `task devops:check:ci-summary` has mixed same-day outcomes (`PASS` at `2026-03-03T02:51:09Z`, `FAIL` at `2026-03-03T16:21:36Z`), so broad-gate readiness is not yet stable.
- Network-only push blockers remain possible outside this environment (DNS, auth, mirror paths); remediation is documented in `05_KNOWN_ISSUES.md`.

## Lane E Reproducibility Provenance (Docs/Repro Closure)

- Canonical command-to-artifact matrix is recorded in:
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_test_matrix.md`
- Residual risk ledger and severity/determinism tracking is recorded in:
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_risks_and_known_issues.md`
- SHA-256 integrity manifest for lane closure evidence is recorded in:
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256`
- Latest targeted rerun evidence used by Lane E closure:
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/lanes-lifecycle-rerun.txt`
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/renderer-lifecycle-rerun.txt`
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303-final-v2.txt`

## Lane F Validation/Handoff Provenance

- Before/after gate classification (deterministic pass vs unstable/flaky fail) is recorded in:
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-f-gate-matrix.md`
- Handoff confidence, residual risks, owner actions, and explicit decision are recorded in:
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-f-handoff.md`
- Current recommendation remains `NO-GO` for full gate promotion until both:
  - `task quality:strict` rerun is green, and
  - `task devops:check:ci-summary` rerun is green
  in the same snapshot window.

## Follow-up Test Tasks

1. Add branch coverage tests for non-blocking warning hotspots and re-run `task quality:strict`.
2. Extend queue push verification with safe dry-run and queue-drain simulations.
3. Add regression coverage for warning-heavy sessions/lifecycle modules in a follow-up lane.
## Supporting Checks

- `task quality:quick` for preflight/typecheck/lint/test.
- `task quality:strict` for broader strict lane, including docs build coverage path.
- `task ci` when full lane confidence is needed.

## Coverage Evidence

- `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303-final.txt` now contains the latest full quality + docs gate pass.

## Provider Lane Focused Validation Commands

Use these focused commands for provider-wave validation before broad gates:
- `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src/providers/__tests__/errors.test.ts apps/runtime/src/providers/__tests__/isolation.test.ts apps/runtime/src/providers/__tests__/adapter.test.ts apps/runtime/src/providers/__tests__/a2a-router.test.ts apps/runtime/src/providers/__tests__/acp-client.test.ts`
- `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src/protocol/bus.ts apps/runtime/src/protocol/envelope.ts apps/runtime/src/protocol/validator.ts`
- `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts`
- `bun test apps/runtime/src/providers/__tests__/adapter.test.ts apps/runtime/src/providers/__tests__/errors.test.ts apps/runtime/src/providers/__tests__/isolation.test.ts apps/runtime/src/providers/__tests__/a2a-router.test.ts apps/runtime/src/providers/__tests__/acp-client.test.ts`
- `task quality:quick`

Execution status for this lane:
- These commands are listed for the provider wave and should be recorded in
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-provider-wave-20260303.md`.
- Do not mark `PASS` in this document until command outputs are attached in that artifact.
