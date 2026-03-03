# Lane B Registry Warning Baseline Summary

Generated: 2026-03-03T16:14:10Z
Scope: registry sources + registry-focused tests, plus current typecheck/test baseline evidence.

## Command Evidence

### Repository status snapshot

```bash
git status --short --branch
```

```text
## heliosapp-upstream-recon...upstream/main [ahead 18]
 M .github/branch-protection.md
 M .github/workflows/self-merge-gate.yml
 M apps/runtime/src/index.ts
 M apps/runtime/src/recovery/__tests__/chaos.test.ts
 M apps/runtime/src/recovery/__tests__/exit-code.test.ts
 M apps/runtime/src/recovery/__tests__/integration.test.ts
 M apps/runtime/src/recovery/__tests__/state-machine.test.ts
 M apps/runtime/src/recovery/__tests__/watchdog.test.ts
 M apps/runtime/src/recovery/banner.ts
 M apps/runtime/src/recovery/state-machine.ts
 M apps/runtime/src/recovery/watchdog.ts
 M apps/runtime/src/registry/binding_middleware.ts
 M apps/runtime/src/registry/binding_triple.ts
 M apps/runtime/src/registry/terminal_registry.ts
 M apps/runtime/tests/integration/registry/binding_lifecycle.test.ts
 M apps/runtime/tests/integration/runtime/test_terminal_lifecycle.test.ts
 M apps/runtime/tests/integration/sessions/harness-routing.test.ts
 M apps/runtime/tests/unit/registry/binding_middleware.test.ts
 M apps/runtime/tests/unit/registry/binding_triple.test.ts
 M apps/runtime/tests/unit/registry/terminal_registry.test.ts
 M apps/runtime/tests/unit/sessions/test_terminal_registry.test.ts
 M docs/sessions/20260303-heliosapp-stabilization/03_DAG_WBS.md
 M docs/sessions/20260303-heliosapp-stabilization/05_KNOWN_ISSUES.md
 M docs/sessions/20260303-heliosapp-stabilization/06_TESTING_STRATEGY.md
?? docs/audits/
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/lane-b-registry-warnings-baseline.csv
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_risks_and_known_issues.md
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_test_matrix.md
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/lanes-lifecycle-rerun.txt
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/quality-strict-20260303-rerun.txt
?? docs/sessions/20260303-heliosapp-stabilization/artifacts/renderer-lifecycle-rerun.txt
```

### Typecheck baseline

```bash
bun run typecheck
```

```text
$ tsc --noEmit
```

### Registry test baseline

```bash
bun test apps/runtime/tests/unit/registry apps/runtime/tests/integration/registry
```

```text
 88 pass
 0 fail
Ran 88 tests across 7 files. [2.74s]
```

### Registry warning baseline

```bash
bunx @biomejs/biome check --diagnostic-level=warn \
  apps/runtime/src/registry \
  apps/runtime/tests/unit/registry \
  apps/runtime/tests/integration/registry \
  --reporter=json
```

```text
warnings=4
```

## Warning Inventory

Total warnings: **4**

Warnings by file:
- apps/runtime/tests/integration/registry/lane_session_integration.test.ts: 1 warning(s)
- apps/runtime/tests/integration/registry/latency_benchmarks.test.ts: 1 warning(s)
- apps/runtime/tests/integration/registry/persistence.test.ts: 2 warning(s)

Warnings by rule:
- lint/complexity/noForEach: 1
- lint/suspicious/noEmptyBlockStatements: 1
- lint/suspicious/noEvolvingTypes: 2

Detailed inventory: [lane-b-registry-warnings-baseline.csv](./lane-b-registry-warnings-baseline.csv)

## Baseline Decision

- Tests and typecheck are passing for the lane-targeted command set.
- Residual registry-scope warnings remain (non-zero warning baseline), so merge-readiness for a warning-free closure is **not yet achieved**.
