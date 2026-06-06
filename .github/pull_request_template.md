## Summary

<!-- Brief description of what this PR does -->

## Worktree / branch

<!-- Worktree path or branch name: -->

## Changes

-

## Spec Traceability

- **Spec**: <!-- e.g. 007-pty-lifecycle-manager -->
- **Work Package**: <!-- e.g. WP01 -->
- **Subtasks**: <!-- e.g. T001-T005 -->

## Test Plan

- [ ] Unit tests pass (`bun test`)
- [ ] Runtime tests pass (`bun test` in `apps/runtime`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] No regressions in existing tests
- [ ] If this PR touches policy or compliance surfaces, confirm `quality-gates` / `compliance-check` are relevant and green (otherwise N/A)

## Review Checklist

- [ ] Code follows project conventions (strict TS, no `any`)
- [ ] New types use `readonly` properties where appropriate
- [ ] Error handling follows bus event pattern (fire-and-forget)
- [ ] No secrets or credentials committed
