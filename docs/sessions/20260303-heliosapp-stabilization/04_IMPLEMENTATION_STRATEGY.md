# Implementation Strategy

## Plan

Apply fixes in WBS order with tight validation loops. This session avoids architectural expansion and limits change to the explicit stabilization set.

## Step Sequence

1. Confirm baseline health from WBS Phase 0.
2. Fix runtime audit/schema/type blockers in `apps/runtime/src/audit/*` and config typing path.
3. Resolve residual runtime warnings in `apps/runtime/src/config/*`, `apps/runtime/src/diagnostics/*`, and `apps/runtime/src/integrations/*`.
4. Re-run targeted Biome/typecheck/tests after each completion cluster.
5. Close publish helper flow regressions in `scripts/push-heliosapp-with-fallback.sh`.
6. Update docs session coverage and index references for the active session.

## Validation Mapping

- `bunx biome check` on touched file groups (as per WBS entries).
- `bun run typecheck`.
- `bun test apps/runtime/tests/unit/renderer/stream_binding.test.ts`.
- `bun test apps/runtime/tests/integration/diagnostics/slo.test.ts`.
- `task devops:check:ci-summary` after cleanup passes.

## Key Decisions

- Keep API/behavior compatibility where runtime protocol surfaces are consumed externally.
- Prefer targeted file-level corrections over broad suppression-based rewrites.
- Treat non-blocking lint noise outside scope as follow-up debt, not lane-blocking defects.
