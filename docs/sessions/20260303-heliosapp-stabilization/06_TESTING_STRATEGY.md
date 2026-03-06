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

## Test Results Snapshot

- `bunx biome check --diagnostic-level=warn apps/runtime/src` currently reports:
  - Warning-only hotspots remain in session/lifecycle-heavy areas, and these are outside blocking scope.
  - This pass intentionally captures warning debt as follow-up hardening tasks.
  - Both integration lifecycle suites pass after Phase 6 runtime fixes.

## Known Gaps

- `task devops:check:ci-summary` passes and now produces passing gate artifacts.
- Network-only push blockers remain possible outside this environment (DNS, auth, mirror paths); remediation is documented in `05_KNOWN_ISSUES.md`.

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
