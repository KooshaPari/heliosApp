# Known Issues

## Lane E Docs/Repro Closure (2026-03-03)

- Lane 6 reproducibility closure artifacts are now published:
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_test_matrix.md`
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_risks_and_known_issues.md`
  - `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256`
- Command provenance is normalized in the matrix artifact and includes lifecycle reruns plus
  `task devops:check:ci-summary` evidence links.
- Artifact integrity is tracked with SHA-256 digests for reproducibility and handoff verification.

## Resolved in this Lane

- `apps/runtime/src/config/store.ts` no-op unsubscribe lint clean-up.
- `apps/runtime/src/diagnostics/percentiles.ts` and `apps/runtime/src/diagnostics/hooks.ts` null assertion/lint fixes.
- `apps/runtime/src/audit/sink.ts` optional metrics and catch-handler adjustments.
- `apps/runtime/src/diagnostics/slo.ts` compatibility-preserving cleanup.
- `apps/runtime/src/config/settings.ts` plus inference files warning reductions.
- `apps/runtime/src/integrations/exec.ts` warning-safe, protocol-preserving fix.
- `scripts/push-heliosapp-with-fallback.sh` `--dry-run`/option forwarding regression fix.
- `scripts/push-heliosapp-with-fallback.sh` shared-helper delegation now falls back to local retry-enabled execution with error taxonomy.

## Remaining

- Network and DNS restrictions can still block `git push` to remote services:
  - Failure mode: `Could not resolve host` or other transient connection class errors.
  - Mitigation: wrapper now classifies these as `dns_network` and applies bounded retries with backoff.
- Local mirror writes can still fail when remote mirror object temp directories are missing/unwritable:
  - Failure mode: `unable to create temporary object directory` / `.tmp` path issues.
  - Mitigation: wrapper now emits one-shot remediation command for `.objects/.tmp` and `objects/tmp` writable setup.
- Full-suite quality confirmation is stable for this lane after passing `task devops:check:ci-summary`.
- Remaining warning hotspots are tracked as follow-up hardening tasks in
  `03_DAG_WBS.md` (Phase 7, Wave D).

## Impact

- No hard lane blockers remain from these items for the documented stabilization scope.
- Branch coverage is stable for the current scope; non-blocking warning hotspots remain
  for a follow-up hardening wave.
- Lane E docs/repro closure is complete with linked evidence and checksum manifest.

## Provider Wave Lint Domains (Remaining)

Evidence-backed remaining warning domains for provider-focused work:
- `apps/runtime/src/providers/__tests__/errors.test.ts`:
  `lint/suspicious/noExplicitAny`, `lint/complexity/noForEach`.
- `apps/runtime/src/providers/__tests__/isolation.test.ts`:
  `lint/suspicious/useAwait`, `lint/complexity/noForEach`, `lint/style/useNamingConvention`.
- `apps/runtime/src/providers/__tests__/adapter.test.ts`:
  `lint/suspicious/useAwait`, `lint/suspicious/noEmptyBlockStatements`.
- `apps/runtime/src/providers/__tests__/a2a-router.test.ts`:
  `lint/suspicious/noExplicitAny`.
- `apps/runtime/src/providers/__tests__/acp-client.test.ts`:
  `lint/suspicious/useAwait`, `lint/complexity/noForEach`.
- `apps/runtime/src/protocol/bus.ts`:
  `lint/suspicious/useAwait`, `lint/style/noNonNullAssertion`.
- `apps/runtime/src/protocol/envelope.ts` and `apps/runtime/src/protocol/validator.ts`:
  `lint/style/useNamingConvention`, `lint/complexity/noExcessiveCognitiveComplexity`.
- `apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts`:
  `lint/suspicious/noExplicitAny` (recovery baseline warnings remain non-zero).

## Explicit Next Fix Routes

- Route 1 (provider tests first):
  run `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src/providers/__tests__`.
- Route 2 (provider protocol boundary):
  run `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src/protocol/bus.ts apps/runtime/src/protocol/envelope.ts apps/runtime/src/protocol/validator.ts`.
- Route 3 (recovery warning carryover):
  run `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts`.
- Route 4 (focused behavior safety after lint edits):
  run `bun test apps/runtime/src/providers/__tests__/adapter.test.ts apps/runtime/src/providers/__tests__/errors.test.ts apps/runtime/src/providers/__tests__/isolation.test.ts apps/runtime/src/providers/__tests__/a2a-router.test.ts apps/runtime/src/providers/__tests__/acp-client.test.ts`.
- Route 5 (integration gate snapshot for parent):
  run `task quality:quick` and attach output under `docs/sessions/20260303-heliosapp-stabilization/artifacts/`.
