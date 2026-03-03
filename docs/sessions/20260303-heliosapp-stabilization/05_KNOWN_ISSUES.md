# Known Issues

## Resolved in this Lane

- `apps/runtime/src/config/store.ts` no-op unsubscribe lint clean-up.
- `apps/runtime/src/diagnostics/percentiles.ts` and `apps/runtime/src/diagnostics/hooks.ts` null assertion/lint fixes.
- `apps/runtime/src/audit/sink.ts` optional metrics and catch-handler adjustments.
- `apps/runtime/src/diagnostics/slo.ts` compatibility-preserving cleanup.
- `apps/runtime/src/config/settings.ts` plus inference files warning reductions.
- `apps/runtime/src/integrations/exec.ts` warning-safe, protocol-preserving fix.
- `scripts/push-heliosapp-with-fallback.sh` `--dry-run`/option forwarding regression fix.

## Remaining

- Branch coverage remains below threshold in current gate artifacts:
  - Source: `.gate-reports/gate-coverage.json`
  - Current: 84% (required 85%)
- Full-suite quality confirmation was not re-run for the entire repo after every microscopic fix.

## Impact

- No hard lane blockers remain from these items for the documented stabilization scope.
- Coverage shortfall is a tracked follow-up item and should be resolved before declaring broader quality parity.
