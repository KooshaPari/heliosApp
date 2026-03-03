# Lane 6 Test Matrix (Docs/Repro Closure)

Generated: 2026-03-03T16:12:16Z
Owner lane: Child Agent E (Docs/repro execution)
Session: `docs/sessions/20260303-heliosapp-stabilization/`

## Command Provenance Matrix

| Command | Evidence timestamp (local) | Exit | Result | Artifact |
|---|---:|---:|---|---|
| `bun test apps/runtime/tests/integration/lanes/lifecycle.test.ts` | 2026-03-03T09:11:40-0700 | 0 | pass (6/6 tests) | `docs/sessions/20260303-heliosapp-stabilization/artifacts/lanes-lifecycle-rerun.txt` |
| `bun test apps/runtime/tests/integration/renderer/lifecycle.test.ts` | 2026-03-03T09:11:44-0700 | 0 | pass (6/6 tests) | `docs/sessions/20260303-heliosapp-stabilization/artifacts/renderer-lifecycle-rerun.txt` |
| `task devops:check:ci-summary` | 2026-03-02T19:59:23-0700 | 0 | pass (`{"repo":"heliosApp","status":"pass"}` present) | `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303-final-v2.txt` |
| `task devops:check:ci-summary` (postrun) | 2026-03-02T19:51:09-0700 | 0 | pass (`task-ci` pass + summary pass marker) | `docs/sessions/20260303-heliosapp-stabilization/artifacts/ci-summary-20260303-postrun-v3.txt` |
| `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src` | 2026-03-02T19:34:29-0700 | 0 | pass-with-warnings (warning inventory capture) | `docs/sessions/20260303-heliosapp-stabilization/artifacts/biome-runtime-src-20260303.txt` |

## Repro Notes

- Repro closure is evidence-backed; commands above are traceable to immutable artifact files.
- Lane lifecycle and renderer lifecycle suites are the required targeted integration checks for this lane closure.
- Quality-gate closure uses `task devops:check:ci-summary` artifacts rather than ad-hoc command snippets.

## Cross-links

- Testing strategy: `docs/sessions/20260303-heliosapp-stabilization/06_TESTING_STRATEGY.md`
- Risk ledger: `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_risks_and_known_issues.md`
- Checksums: `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256`
