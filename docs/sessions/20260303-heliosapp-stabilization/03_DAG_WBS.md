# Phase 2 Stabilization WBS (End-to-End)

Status legend:
- [status:done]
- [status:partial]
- [status:blocked]
- [status:pending]

## Phase 0 — Baseline and Scope
- [status:done] Confirm repository health and current lane context.
- [status:done] Run `task devops:check:ci-summary` and collect full diagnostic output.
- [status:done] Preserve local commits (no --no-verify) and keep workflow artifacts checked in.

## Phase 1 — Core Stabilization (Completed)
- [status:done] Fix TypeScript/lint blockers in runtime audit module (`api.ts`, `bus-subscriber.ts` path fixed in prior lane).
- [status:done] Fix schema/config typing errors introduced during audit refactors.
- [status:done] Validate with targeted diagnostics (`bunx biome check` on touched modules).

## Phase 2 — Residual Quality Debt (in progress)
- [status:done] Trim lint-quality regressions in runtime devops area:
  - [status:done] `apps/runtime/src/config/store.ts` no-op unsubscribe no-empty-block.
  - [status:done] `apps/runtime/src/diagnostics/percentiles.ts` remove unnecessary non-null assertions.
  - [status:done] `apps/runtime/src/diagnostics/hooks.ts` remove unsafe non-null assertions.
  - [status:done] `apps/runtime/src/audit/sink.ts` normalize optional metrics, naming constants, and catch-handler behavior.
  - [status:done] `apps/runtime/src/diagnostics/slo.ts` refactor for complexity/naming compatibility.
- [status:done] Re-run `bun run typecheck` (passes).
- [status:done] Re-run targeted tests:
  - [status:done] `bun test apps/runtime/tests/unit/renderer/stream_binding.test.ts`
  - [status:done] `bun test apps/runtime/tests/integration/diagnostics/slo.test.ts`

## Phase 3 — Remaining Non-Blocking Warnings (pending)
- [status:pending] Clean high-volume lint warnings in:
  - [status:pending] `apps/runtime/src/config/settings.ts` (`noVoid`, `useAwait`, empty catch).
  - [status:pending] `apps/runtime/src/integrations/inference/*` (async/noVoid/naming/style consistency).
  - [status:pending] `apps/runtime/src/integrations/inference/hardware.ts` (strictCase naming adjustments).
  - [status:pending] `apps/runtime/src/diagnostics/types.ts` (SLO* naming rule compatibility).
- [status:pending] Decide whether to keep `SLO*` naming as public compatibility surfaces.
- [status:pending] Validate each file-set after cleanup by targeted `bunx biome check`.

## Phase 4 — Closure and Handoff
- [status:done] Re-run `task devops:check:ci-summary` after every cleanup pass (passes; warnings remain, no failures).
- [status:pending] Decide scope of commit bundling:
  - [status:pending] Commit Phase 2 hardening only (minimal diff).
  - [status:pending] Optionally include broader prior working-tree items only after separate review.
- [status:pending] Update session index links:
  - [status:pending] `docs/index/*.md` entries for current checkpoint if required.
