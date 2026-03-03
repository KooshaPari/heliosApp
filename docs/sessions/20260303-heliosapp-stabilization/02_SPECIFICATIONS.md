# Specifications

## Session Objective

Finalize Phase 2 stabilization by eliminating blocking runtime quality regressions and normalizing devops push flows for the HeliosApp branch.

## In Scope

- TypeScript/lint cleanup for runtime audit, config, diagnostics, and integration files listed in `03_DAG_WBS.md`.
- Fix of wrapper/integration warning regressions in `apps/runtime/src/integrations/exec.ts`.
- Validation via targeted tests and repeated `task devops:check:ci-summary`.
- Queue-based push workflow validation in `scripts/push-heliosapp-with-fallback.sh`.
- Documentation handoff bundle completion for session artifacts.

## Out of Scope

- new feature implementation,
- broad refactors outside scope files,
- replacing non-blocking lint warnings in unrelated areas.

## Acceptance Criteria

- `bun run typecheck` passes.
- `bunx biome check` passes on cleaned runtime subsets.
- Targeted runtime tests pass:
  - `bun test apps/runtime/tests/unit/renderer/stream_binding.test.ts`
  - `bun test apps/runtime/tests/integration/diagnostics/slo.test.ts`
- `task devops:check:ci-summary` completes with no hard failures.
- `task devops:check:ci-summary` pass artifacts are captured under
  `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303-final.txt`.
- `docs/wiki/devops-cicd.md` documents the check/task surface used by this wave.
- `03_DAG_WBS.md` and required missing session docs are present in `docs/sessions/20260303-heliosapp-stabilization`.

## Compatibility Constraint

Keep externally visible runtime API compatibility, including `SLO*` naming behavior where required, even where lint/style preferences conflict.

## Risks and Uncertainties

- Full test+coverage confidence now passes in `task quality:strict`, but branch coverage
  remains a long-running watchlist for warning-level runtime hotspots.
- Any future changes in integration wrappers may re-open warning-level maintenance debt.
