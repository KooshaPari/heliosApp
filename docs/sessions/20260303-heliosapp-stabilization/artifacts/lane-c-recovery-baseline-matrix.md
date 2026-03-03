# Lane C Recovery Baseline Matrix

Generated: 2026-03-03T16:14:10Z
Scope: recovery persistence/enum surfaces using current typecheck + recovery-focused test + warning outputs.

## Baseline Matrix

| Surface | Command | Status | Evidence |
| --- | --- | --- | --- |
| Repo baseline | `git status --short --branch` | PASS | branch ahead with active local edits present (expected shared workspace state) |
| Type safety baseline | `bun run typecheck` | PASS | `$ tsc --noEmit` |
| Recovery tests baseline | `bun test apps/runtime/src/recovery/__tests__ apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts` | PASS | ` 129 pass`, ` 0 fail`, `Ran 129 tests across 10 files. [10.77s]` |
| Recovery warning baseline | `bunx @biomejs/biome check --diagnostic-level=warn apps/runtime/src/recovery apps/runtime/src/recovery/__tests__ apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts --reporter=json` | PARTIAL | `warnings=4` |

## Recovery Warning Details

| File | Rule | Count | Description |
| --- | --- | --- | --- |
| apps/runtime/tests/integration/lanes/watchdog/recovery_suppression.test.ts | lint/suspicious/noExplicitAny | 4 | Unexpected any. Specify a different type. |

## Gap Summary

- Recovery tests and global typecheck currently pass.
- Residual recovery-path warning baseline is concentrated in one integration test file (`noExplicitAny` occurrences), which is the remaining identified gap for warning-closure.
