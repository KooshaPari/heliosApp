# Work Packages — 029 Colab Toolchain Modernization

## Overview

| WP | Title | Subtasks | Priority | Dependencies | Est. Lines |
|----|-------|----------|----------|-------------|------------|
| WP01 | Taskfile + Quality Lanes | T001–T006 | P0 | — | ~400 |
| WP02 | npm→bun Migration + Dep Cleanup | T007–T013 | P0 | WP01 | ~450 |
| WP03 | CI Workflow + Verification | T014–T018 | P1 | WP02 | ~350 |
| WP04 | Constitution + MLX ADR | T019–T024 | P1 | WP01 | ~400 |

## Subtask Registry

| ID | Description | WP | Parallel |
|----|-------------|-----|----------|
| T001 | Create Taskfile.yml with dev/build/test tasks | WP01 | — |
| T002 | Add quality task (fmt + test + lint, mutating) | WP01 | — |
| T003 | Add quality:quick (readonly, no --write) | WP01 | — |
| T004 | Add quality:ci (non-mutating PR gate) | WP01 | — |
| T005 | Add quality:pre-push + quality:release-lint | WP01 | — |
| T006 | Add check alias → quality | WP01 | — |
| T007 | Migrate package.json push:* scripts npm→bun | WP02 | [P] |
| T008 | Replace npm references in README.md | WP02 | [P] |
| T009 | Replace npm references in test-plugin/README.md | WP02 | [P] |
| T010 | Replace npm/npx in webflow-plugin sources | WP02 | [P] |
| T011 | Replace npm references in ColabTerminal.ts comments | WP02 | [P] |
| T012 | Remove ansi-to-html dependency | WP02 | [P] |
| T013 | Replace fs-extra with bun-native fs APIs | WP02 | — |
| T014 | Update .github/workflows/build-release.yml npm→bun | WP03 | — |
| T015 | Add go-task installation step to CI | WP03 | — |
| T016 | Wire CI quality gate to `task quality:ci` | WP03 | — |
| T017 | Verify build passes without npm | WP03 | — |
| T018 | Verify all 178 tests pass | WP03 | — |
| T019 | Create CONSTITUTION.md | WP04 | [P] |
| T020 | Document runtime + testing + formatting decisions | WP04 | — |
| T021 | Document library preferences + bun builtins policy | WP04 | — |
| T022 | Document architecture principles | WP04 | — |
| T023 | Create docs/adr/001-mlx-inference-evaluation.md | WP04 | [P] |
| T024 | Document MLX migration path + fallback strategy | WP04 | — |

---

## WP01: Taskfile + Quality Lanes

**Goal**: Create Taskfile.yml with full quality lane hierarchy matching clipproxyapi++ pattern.

**Priority**: P0 — foundation for all other WPs

**Included Subtasks**:
- [x] T001: Create Taskfile.yml with dev/build/test tasks
- [x] T002: Add quality task (fmt + test + lint, mutating)
- [x] T003: Add quality:quick (readonly, no --write)
- [x] T004: Add quality:ci (non-mutating PR gate)
- [x] T005: Add quality:pre-push + quality:release-lint
- [x] T006: Add check alias → quality

**Implementation Sketch**:
1. Create `Taskfile.yml` at repo root with `version: '3'`
2. Add `dev`, `build`, `test` tasks wrapping bun commands
3. Add `quality:fmt`, `quality:test`, `quality:lint` subtasks
4. Compose `quality` from subtasks with deps
5. Add readonly variants (quality:quick, quality:ci)
6. Add hook targets (quality:pre-push) and release validation (quality:release-lint)
7. Add `check` as alias for `quality`

**Parallel Opportunities**: None — sequential build-up of Taskfile

**Dependencies**: None

**Success Criteria**: `task quality` runs fmt+test+lint; `task quality:ci` runs without --write flags

**Prompt**: `tasks/WP01-taskfile-quality-lanes.md`

---

## WP02: npm→bun Migration + Dependency Cleanup

**Goal**: Eliminate all npm references and remove/replace unused dependencies.

**Priority**: P0 — required for CI and build integrity

**Included Subtasks**:
- [x] T007: Migrate package.json push:* scripts npm→bun
- [x] T008: Replace npm references in README.md
- [x] T009: Replace npm references in test-plugin/README.md
- [x] T010: Replace npm/npx in webflow-plugin sources
- [x] T011: Replace npm references in ColabTerminal.ts comments
- [x] T012: Remove ansi-to-html dependency
- [x] T013: Replace fs-extra with bun-native fs APIs

**Implementation Sketch**:
1. Update package.json push:* scripts (npm version → bun version or Taskfile)
2. Search-and-replace npm→bun in all documentation
3. Remove ansi-to-html from package.json, run bun install
4. Find all fs-extra imports, replace with node:fs or Bun builtins

**Parallel Opportunities**: T007-T012 are independent file edits [P]

**Dependencies**: WP01 (Taskfile must exist for script migration targets)

**Success Criteria**: `grep -r "npm" --include="*.ts" --include="*.md" --include="*.json" --include="*.yml"` returns only legitimate references (npm registry URLs, peerDependencies/node.ts)

**Prompt**: `tasks/WP02-npm-bun-migration.md`

---

## WP03: CI Workflow + Verification

**Goal**: Update CI to use bun+task, verify build and all tests pass.

**Priority**: P1 — validates WP01+WP02

**Included Subtasks**:
- [x] T014: Update .github/workflows/build-release.yml npm→bun
- [x] T015: Add go-task installation step to CI
- [ ] T016: Wire CI quality gate to `task quality:ci`
- [ ] T017: Verify build passes without npm
- [ ] T018: Verify all 178 tests pass

**Implementation Sketch**:
1. Replace Node.js setup with Bun setup in CI workflow
2. Add go-task install step
3. Replace npm commands with task/bun equivalents
4. Run build and test suite to verify

**Parallel Opportunities**: None — sequential verification

**Dependencies**: WP02

**Success Criteria**: CI workflow uses only bun/task commands; build succeeds; 178/178 tests pass

**Prompt**: `tasks/WP03-ci-verification.md`

---

## WP04: Constitution + MLX ADR

**Goal**: Create project governance document and MLX evaluation ADR.

**Priority**: P1 — documentation deliverables

**Included Subtasks**:
- [ ] T019: Create CONSTITUTION.md
- [ ] T020: Document runtime + testing + formatting decisions
- [ ] T021: Document library preferences + bun builtins policy
- [ ] T022: Document architecture principles
- [ ] T023: Create docs/adr/001-mlx-inference-evaluation.md
- [ ] T024: Document MLX migration path + fallback strategy

**Implementation Sketch**:
1. Create CONSTITUTION.md with sections: Runtime, Testing, Formatting, Task Runner, Quality Lanes
2. Add library preferences section (prefer bun builtins over npm packages)
3. Add architecture principles (feature flags, RPC, worktree discipline)
4. Create ADR directory and MLX evaluation document
5. Document: performance comparison, integration surface, migration path, fallback strategy

**Parallel Opportunities**: T019-T022 (constitution) and T023-T024 (ADR) are independent [P]

**Dependencies**: WP01 (constitution references Taskfile conventions)

**Success Criteria**: CONSTITUTION.md < 200 lines, covers all toolchain decisions; ADR covers MLX vs llama.cpp with migration path

**Prompt**: `tasks/WP04-constitution-mlx-adr.md`
