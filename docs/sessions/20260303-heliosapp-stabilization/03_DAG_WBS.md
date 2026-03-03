# Phase 2 Stabilization WBS (End-to-End)

Status legend:
- [status:done]
- [status:in_progress]
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

## Phase 3 — Remaining Non-Blocking Warnings (partial)
- [status:done] Clean high-volume lint warnings in:
  - [status:done] `apps/runtime/src/config/settings.ts` (`noVoid`, `useAwait`, empty catch).
  - [status:done] `apps/runtime/src/integrations/inference/*` (async/noVoid/naming/style consistency).
  - [status:done] `apps/runtime/src/integrations/inference/hardware.ts` (strictCase naming adjustments).
  - [status:done] `apps/runtime/src/diagnostics/types.ts` (SLO* naming rule compatibility).
- [status:done] Validate each file-set after cleanup by targeted `bunx biome check`.
- [status:done] Remaining non-blocking lint surface in unrelated `apps/runtime/src/integrations/exec.ts` (`noVoid`, `useNamingConvention`) resolved with protocol-safe suppressions and behavior-preserving fix.
- [status:done] `SLO*` naming kept for public compatibility surfaces to avoid protocol/API drift.

## Phase 4 — Closure and Handoff
- [status:done] Re-run `task devops:check:ci-summary` after every cleanup pass (passes; warnings remain, no failures).
- [status:done] Decide scope of commit bundling and stage/commit:
  - [status:done] Commit Phase 2 hardening and current working-tree stabilization.
  - [status:done] Include broader related docs/runtime/desktop stability items after local review.
- [status:done] Update session index links:
  - [status:done] `docs/index/*.md` entries and `docs/sessions/20260303-heliosapp-stabilization`.

## Phase 5 — Publish Readiness and Non-Sandbox Flow
- [status:done] Validate shared helper delegation path (`repo-push-fallback.sh`) and local fallback checks.
- [status:done] Fix wrapper regression: `--dry-run` and explicit option forwarding to shared helper.
- [status:done] Publish to local mirror remote successfully using queue/queue-worker mode.
- [status:done] Push to upstream origin branch when network and branch alignment are available.

## Phase 6 — Immediate Next Actions (24-task run)
- [status:done] Validate remaining ghostty and lane files against formatter/lint:
  - [status:done] `apps/runtime/src/renderer/ghostty/index.ts`
  - [status:done] `apps/runtime/src/renderer/ghostty/process.ts`
  - [status:done] `apps/runtime/src/renderer/ghostty/capabilities.ts`
  - [status:done] `apps/runtime/src/lanes/index.ts`
- [status:done] Remove remaining test hygiene blockers in renderer stubs:
  - [status:done] `apps/runtime/src/renderer/__tests__/switch.test.ts`
  - [status:done] `apps/runtime/src/renderer/__tests__/stream_binding.test.ts`
  - [status:done] `apps/runtime/src/renderer/__tests__/rio.test.ts`
  - [status:done] `apps/runtime/src/policy/rules.ts` complexity/format adjustments
- [status:done] Create/update reusable reconciliation and cleanup flow:
  - [status:done] Decompose lane cleanup path into dedicated helper methods.
  - [status:done] Decompose orphan-reconciliation into per-phase helpers.
  - [status:done] Fix lane cleanup event sequence and state transition logic.
  - [status:done] Keep API behavior unchanged (no semantic interface changes).
- [status:done] Expand validation beyond touched files:
  - [status:done] Run `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src`
  - [status:done] Run `bun test apps/runtime/tests/integration/renderer/lifecycle.test.ts`
  - [status:done] Run `bun test apps/runtime/tests/integration/lanes/lifecycle.test.ts`
  - [status:done] Capture and attach output snapshots for all runs.
- [status:done] Hardening for publish in restricted environments:
  - [status:done] Audit `scripts/repo-push-fallback.sh` for DNS/fallback behavior and shared-helper handoff.
  - [status:done] Add deterministic retry + error taxonomy for push blockers in wrapper flow.
  - [status:done] Add one-shot remediation note for missing upstream local-object temp paths.
  - [status:done] Add `docs/sessions/.../05_KNOWN_ISSUES.md` entry for network/DNS constraints.
- [status:done] CI and policy alignment wave:
  - [status:done] Ensure CodeRabbit and Gemini review triggers remain available.
  - [status:done] Validate required check names via `required-check-names-guard` in task output.
  - [status:done] Verify required checks list in `.github/required-checks.txt` and governance docs.
  - [status:done] Confirm `task devops:check:ci-summary` and policy workflows execute without hard failures.
- [status:done] Documentation + handoff:
  - [status:done] Update `/docs/sessions/20260303-heliosapp-stabilization/04_IMPLEMENTATION_STRATEGY.md`.
  - [status:done] Update `/docs/sessions/20260303-heliosapp-stabilization/06_TESTING_STRATEGY.md`.
  - [status:done] Add post-change risk note in `05_KNOWN_ISSUES.md`.
  - [status:done] Prepare minimal handoff summary and scope note for next push task.

## Phase 7 — Next 24-task execution wave (all remaining work, 4 tasks per lane)

### Wave A (Gates and policy)
- [status:done] Pull live branch-protection and required-check settings via API/`required-checks.txt`.
- [status:done] Validate `required_pull_request_reviews` and status-check scopes against branch policy.
- [status:done] Snapshot branch-protection drift proof in `docs/sessions/20260303-heliosapp-stabilization/artifacts/branch-protection-check.txt`.
- [status:done] Resolve any policy drift before next merge window (alignment by removing optional file-only checks from `required-checks.txt` to match enforced branch policy).

### Wave B (Publish worker reliability)
- [status:done] Add JSON output mode for push failures in `scripts/push-heliosapp-with-fallback.sh`.
- [status:done] Add local retry counters for `dns_network` and `object_tmp_dir`.
- [status:done] Add dry-run integration coverage for queue drain/replay.
- [status:done] Document remediation sequence for persistent queue failures.

### Wave C (DevOps checkers docs)
- [status:done] Create/update `docs/wiki/devops-checkers.md` with checker catalog.
- [status:done] Add cross-repo check-reference notes for sibling Phenotype repositories.
- [status:done] Add bot trigger/cooldown guidance to the checker page.
- [status:done] Regenerate docs index and validate links after checker doc updates.

### Wave D (Task/just parity)
- [status:done] Add explicit task/just alias parity table in VitePress checker docs.
- [status:done] Add one-line cheat-sheet commands for queue and dry-run lanes.
- [status:done] Track alias drift check in `04_IMPLEMENTATION_STRATEGY.md`.
- [status:pending] Keep `Justfile` and `Taskfile` aliases aligned during future additions.

### Wave E (Runtime warning hardening)
- [status:pending] Resolve remaining branch-warning hotspots in `apps/runtime/src/registry`.
- [status:pending] Resolve remaining branch-warning hotspots in `apps/runtime/src/sessions`.
- [status:pending] Resolve remaining branch-warning hotspots in `apps/runtime/src/recovery`.
- [status:pending] Re-run `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src`.

### Wave F (Coverage confidence)
- [status:pending] Add branch coverage tests for warning-heavy modules.
- [status:pending] Re-run `task quality:strict` after targeted coverage additions.
- [status:pending] Confirm coverage/quality artifact stability in next `ci-summary` handoff.
- [status:pending] Update `docs/sessions/20260303-heliosapp-stabilization/artifacts` with every run.

## Phase 8 — Child-Agent Wave Plan (24 tasks, 6 lanes x 4)

### Lane A (Governance parity)
- [status:in_progress] Make `.github/required-checks.txt` the explicit canonical source in governance docs.
- [status:done] Add `.github/scripts/verify-required-check-names.sh` with duplicate + missing checks validation.
- [status:done] Wire `required-check-names-guard` workflow to run the shared verifier script.
- [status:done] Add local governance parity commands (`task governance:required-checks`, `just governance-required-checks`).

### Lane B (Publish worker reliability)
- [status:done] Add dedicated publish worker entrypoint at `scripts/publish-worker.sh` with non-sandbox opt-in gate.
- [status:done] Add single-worker lock behavior using `.git/publish-worker.lock`.
- [status:done] Upgrade queue entries to NDJSON and keep TSV backward-read support in drain path.
- [status:done] Add task/just worker lanes (`devops:publish-worker:once`, `devops:publish-worker:loop`).

### Lane C (Docs and parity cleanup)
- [status:done] Normalize devops docs to use job-name semantics for required-check manifest.
- [status:done] Align workflow inventory across `docs/wiki/devops-checkers.md` and `docs/wiki/devops-cicd.md`.
- [status:done] Add missing just aliases for e2e task lanes.
- [status:done] Standardize canonical command references (alias-first, raw helper as advanced fallback).

### Lane D (Workflow hardening)
- [status:done] Harden `compliance-check.yml` with deterministic parse/output and sticky PR comment update.
- [status:done] Add artifact upload + step summary for compliance outputs.
- [status:done] Harden `gca.yml` token handling (fork/no-token skip, internal missing-token fail).
- [status:done] Add gca summary + deduplicated rate-limit PR comment update.

### Lane E (Runtime warning reduction)
- [status:done] Resolve `apps/runtime/src/registry/binding_events.ts` naming warnings for topics + envelope keys.
- [status:done] Resolve `apps/runtime/src/registry/persistence.ts` warnings (`noExplicitAny`, empty block, async without await).
- [status:done] Resolve `apps/runtime/src/registry/binding_middleware.ts` warnings (`noNonNullAssertion`, async without await).
- [status:pending] Re-run focused registry/sessions/recovery warning scans and close residual warnings.

### Lane F (Validation and evidence)
- [status:pending] Re-run targeted integration lifecycle tests and capture artifact output.
- [status:pending] Re-run `task quality:strict` and capture output artifact.
- [status:pending] Re-run `task devops:check:ci-summary` and capture handoff artifact.
- [status:pending] Refresh artifact manifest + checksums and link updates in testing strategy.
