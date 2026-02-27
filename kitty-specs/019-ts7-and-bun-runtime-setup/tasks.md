# Work Packages: TS7 and Bun Runtime Setup

**Inputs**: Design documents from `/kitty-specs/019-ts7-and-bun-runtime-setup/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the constitution requires strict validation and zero-error builds.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/019-ts7-and-bun-runtime-setup/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Monorepo Structure, TypeScript Config, and Bun Workspace Setup (Priority: P0 — prerequisite to all other WPs)

**Phase**: Phase 0 - Foundation
**Goal**: Establish the Bun workspace monorepo with root and per-package configs, TypeScript 7 strict-mode base config, and ElectroBun desktop/runtime package scaffolding.
**Independent Test**: `bun install` resolves all workspace dependencies; `bun run typecheck` exits 0 on the scaffolded codebase; path aliases resolve in both packages.
**Prompt**: `/kitty-specs/019-ts7-and-bun-runtime-setup/tasks/WP01-monorepo-structure-and-tsconfig.md`
**Estimated Prompt Size**: ~300 lines

### Included Subtasks
- [x] T001 Create root `package.json` with Bun workspace declarations for `apps/desktop` and `apps/runtime`, minimum Bun version, and TypeScript 7 dependency
- [x] T002 Create `bunfig.toml` with workspace resolution config, minimum Bun version enforcement, and registry settings
- [x] T003 Create `tsconfig.base.json` with TS7 strict mode, noImplicitAny, strictNullChecks, and shared compiler options
- [x] T004 [P] Create `apps/desktop/package.json`, `apps/desktop/tsconfig.json` extending base, and `apps/desktop/src/index.ts` scaffold with ElectroBun entry point
- [x] T005 [P] Create `apps/runtime/package.json`, `apps/runtime/tsconfig.json` extending base, and `apps/runtime/src/index.ts` scaffold
- [x] T006 Configure path aliases in tsconfig files and verify resolution works for cross-workspace imports
- [x] T007 Validate: `bun install` completes cleanly, workspace linking works, and `bun run typecheck` passes with zero errors

### Implementation Notes
- Keep root `package.json` workspace paths explicit (`apps/*`).
- Enforce TS7 strict mode flags at the base level; per-package configs must not weaken them.
- ElectroBun entry point in `apps/desktop` should be minimal but functional.

### Parallel Opportunities
- T004 and T005 can proceed after T003 base config is stable.

### Dependencies
- None.

### Risks & Mitigations
- Risk: TypeScript 7 prerelease introduces breaking config changes.
- Mitigation: Pin to a specific TS7 version in `package.json`; document upgrade path.

---

## Work Package WP02: Build, Dev, and Typecheck Scripts with Path Aliases and Tests (Priority: P0)

**Goal**: Deliver working `bun dev`, `bun run build`, and `bun run typecheck` commands; validate path alias resolution end-to-end; add foundational build infrastructure tests.
**Independent Test**: `bun dev` starts the dev server with hot-reload; `bun run build` produces a launchable desktop artifact; deliberate type errors cause `bun run typecheck` to fail with clear diagnostics.
**Prompt**: `/kitty-specs/019-ts7-and-bun-runtime-setup/tasks/WP02-build-dev-typecheck-scripts.md`
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [ ] T008 Implement `bun dev` script with hot-reload support across workspace packages and ElectroBun desktop shell launch
- [ ] T009 Implement `bun run build` script producing a production-optimized ElectroBun desktop artifact
- [ ] T010 Implement `bun run typecheck` as a standalone strict-mode type-checking gate across all workspace packages
- [ ] T011 [P] Add path alias resolution validation tests — confirm aliases resolve in build output, dev server, and runtime contexts
- [ ] T012 [P] Add build infrastructure tests: verify dev server starts, build produces artifact, typecheck catches deliberate errors, circular dependency detection works
- [ ] T013 Validate NFR compliance: `bun install` < 30s, dev server cold start < 5s, typecheck < 15s on reference hardware

### Implementation Notes
- `bun run typecheck` must be a discrete gate that can run independently of build.
- Hot-reload must propagate changes from `apps/runtime` into the running `apps/desktop` dev session.
- Build output must be a self-contained ElectroBun artifact.

### Parallel Opportunities
- T011 and T012 can proceed after T008/T009/T010 scripts are functional.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: ElectroBun build integration is unstable in prerelease.
- Mitigation: Isolate ElectroBun-specific config; fall back to basic Bun bundle if ElectroBun packaging breaks.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02.
- **Parallelization**: Within WP01, T004/T005 can run concurrently after T003; within WP02, T011/T012 can run concurrently after core scripts land.
- **MVP Scope**: Both WPs are required for any downstream spec work.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Root package.json with workspaces and TS7 | WP01 | P0 | No |
| T002 | bunfig.toml workspace config | WP01 | P0 | No |
| T003 | tsconfig.base.json strict TS7 | WP01 | P0 | No |
| T004 | apps/desktop package scaffold | WP01 | P0 | Yes |
| T005 | apps/runtime package scaffold | WP01 | P0 | Yes |
| T006 | Path alias configuration | WP01 | P0 | No |
| T007 | Install and typecheck validation | WP01 | P0 | No |
| T008 | bun dev script with hot-reload | WP02 | P0 | No |
| T009 | bun run build production artifact | WP02 | P0 | No |
| T010 | bun run typecheck standalone gate | WP02 | P0 | No |
| T011 | Path alias resolution tests | WP02 | P0 | Yes |
| T012 | Build infrastructure tests | WP02 | P0 | Yes |
| T013 | NFR performance validation | WP02 | P0 | No |
