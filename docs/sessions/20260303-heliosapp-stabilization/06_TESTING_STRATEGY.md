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

## Supporting Checks

- `task quality:quick` for preflight/typecheck/lint/test.
- `task quality:strict` for broader strict lane, including docs build coverage path.
- `task ci` when full lane confidence is needed.

## Known Gaps

- Coverage gate is currently failing branch threshold at 84% vs 85%.
- Non-scoped runtime lint warnings were intentionally left for follow-up rather than broad lane expansion.

## Follow-up Test Tasks

1. Add branch coverage tests for runtime paths still below threshold and re-run `task quality:strict`.
2. Re-run full `task devops:check:ci-summary` after follow-up tests.
3. Exercise queue push path with dry-run and actual remote fallback where safe in review environment.
