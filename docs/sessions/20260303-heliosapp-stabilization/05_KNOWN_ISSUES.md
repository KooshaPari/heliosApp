# Known Issues

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
