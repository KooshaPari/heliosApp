---
work_package_id: WP03
title: CI Workflow + Verification
lane: planned
dependencies: []
subtasks: [T014, T015, T016, T017, T018]
history:
- date: '2026-02-28'
  action: created
  agent: claude-opus
---

# WP03: CI Workflow + Verification

## Objective

Update the GitHub Actions CI workflow to use bun and task commands exclusively (no npm), add go-task installation, and verify that build + tests pass end-to-end.

## Context

- **CI file**: `.github/workflows/build-release.yml`
- **Current issues**: Lines 232-235 set up Node.js for npm publishing; line 248 uses `npm version`; line 253 uses `npm publish`
- **Target**: CI uses `bun install`, `bun run`, and `task` commands only
- **go-task install**: `sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin`

## Implementation Command

```bash
spec-kitty implement WP03 --base WP02
```

---

## Subtask T014: Update .github/workflows/build-release.yml npm→bun

**Purpose**: Replace all npm commands in the CI workflow with bun equivalents.

**Steps**:
1. Open `.github/workflows/build-release.yml`
2. Find the Node.js setup section (lines ~232-235) — evaluate if still needed:
   - If only used for `npm publish`: replace with `bunx npm publish` and remove Node.js setup
   - If other Node.js deps exist: keep but add Bun setup alongside
3. Replace `npm version ${{ steps.version.outputs.VERSION }} --no-git-tag-version --allow-same-version` (line ~248) with:
   - `bunx npm version ${{ steps.version.outputs.VERSION }} --no-git-tag-version --allow-same-version`
4. Replace `npm publish --access public` (line ~253) with:
   - `bunx npm publish --access public` (for npm registry publishing, bunx npm is correct)
5. Replace any `npm install` or `npm ci` steps with `bun install`

**Files**: `.github/workflows/build-release.yml`

**Validation**:
- [ ] No bare `npm` commands in workflow (only `bunx npm` for registry publishing)
- [ ] Bun setup step exists in workflow

---

## Subtask T015: Add go-task installation step to CI

**Purpose**: Make `task` available in CI runners.

**Steps**:
1. Add a step early in the workflow (before any `task` commands):
   ```yaml
   - name: Install go-task
     run: |
       sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin
       task --version
   ```
2. Place after checkout and bun setup, before any build/test steps

**Files**: `.github/workflows/build-release.yml`

**Validation**:
- [ ] `task --version` succeeds in CI
- [ ] Step runs before any `task` commands

---

## Subtask T016: Wire CI quality gate to `task quality:ci`

**Purpose**: Use the Taskfile quality lane for CI checks.

**Steps**:
1. Find existing lint/test/check steps in the CI workflow
2. Replace with single step:
   ```yaml
   - name: Quality gate
     run: task quality:ci
   ```
3. If the workflow has separate test and lint steps, consolidate into `task quality:ci`

**Files**: `.github/workflows/build-release.yml`

**Validation**:
- [ ] CI workflow calls `task quality:ci`
- [ ] No duplicate lint/test steps remain

---

## Subtask T017: Verify build passes without npm

**Purpose**: Confirm the build pipeline works with bun-only toolchain.

**Steps**:
1. Run `bun install` (no npm)
2. Run `task build` or `bun run build:dev`
3. Verify output artifacts are produced
4. Check no npm-related errors in build output

**Files**: None (verification only)

**Validation**:
- [ ] `bun install` succeeds
- [ ] `task build` (or `bun run build:dev`) produces build output
- [ ] No npm errors in build log

---

## Subtask T018: Verify all 178 tests pass

**Purpose**: Confirm no regressions from migration changes.

**Steps**:
1. Run `task test` or `bunx vitest run`
2. Verify 178/178 tests pass
3. If any failures, investigate and fix

**Files**: None (verification only)

**Validation**:
- [ ] 178/178 tests pass
- [ ] No new test failures introduced by migration

---

## Definition of Done

- [ ] CI workflow uses bun + task commands exclusively
- [ ] go-task installed in CI via install script
- [ ] `task quality:ci` is the CI quality gate
- [ ] No bare `npm` commands in CI (only `bunx npm` for registry publishing)
- [ ] Build succeeds locally
- [ ] All 178 tests pass

## Risks

- **npm publish**: npm registry publishing may require `npm` or `bunx npm`. Using `bunx npm publish` should work but test in CI.
- **go-task install in CI**: The install script may need sudo. Check runner permissions.
- **Bun setup action**: Use `oven-sh/setup-bun@v2` action for CI.

## Reviewer Guidance

- Check that npm registry publishing still works (bunx npm publish is the correct pattern)
- Verify go-task version is v3.x compatible
- Confirm quality:ci runs the same checks as local quality:quick (non-mutating)
