---
work_package_id: "WP01"
title: "Taskfile + Quality Lanes"
lane: "done"
dependencies: []
subtasks: ["T001", "T002", "T003", "T004", "T005", "T006"]
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
  - date: "2026-02-28"
    action: "created"
    agent: "claude-opus"
---

# WP01: Taskfile + Quality Lanes

## Objective

Create a `Taskfile.yml` at the co(lab) repository root that provides the full quality lane hierarchy matching the Phenotype organization standard (clipproxyapi++ pattern). This is the foundation WP — all other work packages depend on this.

## Context

- **Repository**: KooshaPari/colab fork, worktree at `colab-wtrees/helios-integration/`
- **Pattern source**: clipproxyapi++ uses `quality` (canonical), `quality:quick`, `quality:ci`, `quality:pre-push`, `quality:release-lint`
- **Tools**: Biome (formatter/linter, already configured via biome.json), vitest (test runner), bun (runtime)
- **Reference**: All Phenotype TypeScript repos use Taskfile.yml with go-task v3.x

## Implementation Command

```bash
spec-kitty implement WP01
```

---

## Subtask T001: Create Taskfile.yml with dev/build/test tasks

**Purpose**: Establish the base Taskfile with standard development commands.

**Steps**:
1. Create `Taskfile.yml` at repo root with `version: '3'`
2. Add task `dev`:
   ```yaml
   dev:
     desc: Start development server
     cmds:
       - bun run dev
   ```
3. Add task `build`:
   ```yaml
   build:
     desc: Production build
     cmds:
       - bun run build:stable
   ```
4. Add task `test`:
   ```yaml
   test:
     desc: Run test suite
     cmds:
       - bun run test
   ```
5. Add task `setup`:
   ```yaml
   setup:
     desc: Install dependencies and vendor native binaries
     cmds:
       - bun install
       - bun run setup
   ```

**Files**: `Taskfile.yml` (new, ~30 lines initially)

**Validation**:
- [ ] `task dev` starts the dev server
- [ ] `task build` runs production build
- [ ] `task test` runs vitest

---

## Subtask T002: Add quality task (fmt + test + lint, mutating)

**Purpose**: Create the canonical `quality` task that runs all checks with file mutation (format --write).

**Steps**:
1. Add `quality:fmt` subtask:
   ```yaml
   quality:fmt:
     desc: Format code (mutating)
     cmds:
       - bunx biome format --write .
   ```
2. Add `quality:lint` subtask:
   ```yaml
   quality:lint:
     desc: Lint code
     cmds:
       - bunx biome lint .
   ```
3. Add `quality:test` subtask:
   ```yaml
   quality:test:
     desc: Run tests
     cmds:
       - bunx vitest run
   ```
4. Add `quality` composite task:
   ```yaml
   quality:
     desc: Full quality gate (format + lint + test)
     cmds:
       - task: quality:fmt
       - task: quality:lint
       - task: quality:test
   ```

**Files**: `Taskfile.yml` (extend)

**Validation**:
- [ ] `task quality` runs format, lint, and tests in sequence
- [ ] Files are actually formatted (--write flag active)

---

## Subtask T003: Add quality:quick (readonly, no --write)

**Purpose**: Fast readonly check for inner-loop feedback — no file mutations.

**Steps**:
1. Add task:
   ```yaml
   quality:quick:
     desc: Quick readonly quality check (no file writes)
     cmds:
       - bunx biome check .
       - bunx vitest run
   ```

**Files**: `Taskfile.yml` (extend)

**Validation**:
- [ ] `task quality:quick` runs without modifying any files
- [ ] Exits non-zero if lint/format issues exist

---

## Subtask T004: Add quality:ci (non-mutating PR gate)

**Purpose**: CI-safe quality check — identical to quality:quick but explicitly named for CI pipelines.

**Steps**:
1. Add task:
   ```yaml
   quality:ci:
     desc: CI quality gate (non-mutating, suitable for PR checks)
     cmds:
       - bunx biome check .
       - bunx vitest run
   ```

**Files**: `Taskfile.yml` (extend)

**Validation**:
- [ ] `task quality:ci` runs without --write flags
- [ ] Suitable for use in GitHub Actions workflow

---

## Subtask T005: Add quality:pre-push + quality:release-lint

**Purpose**: Git hook target and release validation.

**Steps**:
1. Add pre-push hook target:
   ```yaml
   quality:pre-push:
     desc: Pre-push git hook quality check
     cmds:
       - task: quality:quick
   ```
2. Add release lint:
   ```yaml
   quality:release-lint:
     desc: Release validation checks
     cmds:
       - echo "Checking version consistency..."
       - bunx biome check .
       - bunx vitest run
       - echo "Release lint passed"
   ```

**Files**: `Taskfile.yml` (extend)

**Validation**:
- [ ] `task quality:pre-push` runs fast readonly checks
- [ ] `task quality:release-lint` validates release readiness

---

## Subtask T006: Add check alias → quality

**Purpose**: Backward compatibility — `task check` should run the full quality gate.

**Steps**:
1. Add alias task:
   ```yaml
   check:
     desc: Alias for quality (full quality gate)
     cmds:
       - task: quality
   ```

**Files**: `Taskfile.yml` (extend)

**Validation**:
- [ ] `task check` produces identical output to `task quality`

---

## Definition of Done

- [ ] `Taskfile.yml` exists at repo root with version 3
- [ ] All tasks listed: dev, build, test, setup, quality, quality:fmt, quality:lint, quality:test, quality:quick, quality:ci, quality:pre-push, quality:release-lint, check
- [ ] `task quality` runs format+lint+test (mutating)
- [ ] `task quality:ci` runs without file writes
- [ ] `task check` aliases `task quality`
- [ ] Existing 178 tests still pass via `task test`

## Risks

- **Biome config**: If `biome.json` doesn't exist, `bunx biome` commands will fail. Check for its existence; if missing, create a minimal config with `lineWidth: 100`.
- **go-task version**: Ensure Taskfile.yml syntax is compatible with v3.x (use `version: '3'`).

## Reviewer Guidance

- Verify task names match clipproxyapi++ conventions exactly
- Confirm quality:ci has NO --write flags
- Check that quality:quick and quality:ci are truly non-mutating


## Activity Log

- 2026-02-28T12:35:23Z – unknown – lane=done – Implemented, PR #6 created
