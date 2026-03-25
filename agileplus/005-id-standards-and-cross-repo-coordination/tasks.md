# Work Packages: ID Standards and Cross-Repo Coordination

**Inputs**: Design documents from `/kitty-specs/005-id-standards-and-cross-repo-coordination/`
**Prerequisites**: plan.md (required), spec.md (user stories)

**Tests**: Include explicit testing work because the feature spec requires collision resistance at scale, cross-repo compatibility, and sub-microsecond performance.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/005-id-standards-and-cross-repo-coordination/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `packages/` and `kitty-specs/`.

---

## Work Package WP01: ULID Library, Prefix Format, and Validation (Priority: P0)

**Phase**: Phase 1 - Foundation
**Goal**: Implement self-contained ULID generation with monotonic ordering, prefix registry, ID generation API, validation, and parsing. Zero runtime dependencies.
**Independent Test**: 10M IDs across 8 threads produce zero collisions; all IDs match format spec; generation < 0.01ms; validation < 0.005ms.
**Prompt**: `/kitty-specs/005-id-standards-and-cross-repo-coordination/tasks/WP01-ulid-library-prefix-format-and-validation.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [x] T001 Implement self-contained ULID generation with monotonic ordering in `packages/ids/src/ulid.ts`
- [x] T002 Define prefix registry mapping entity types to prefixes in `packages/ids/src/prefixes.ts`
- [x] T003 Implement `generateId(entityType)` public API in `packages/ids/src/index.ts`
- [x] T004 Implement `validateId(raw)` with format, prefix, and ULID integrity checks in `packages/ids/src/validate.ts`
- [x] T005 Implement `parseId(raw)` extracting entity type and timestamp in `packages/ids/src/parse.ts`
- [x] T006 [P] Add Vitest unit tests for generation, validation, and parsing in `packages/ids/tests/`

### Implementation Notes
- ULID: 10-char timestamp (ms since Unix epoch in Crockford base32) + 16-char random. Total 26 chars.
- Monotonic: if same millisecond as previous, increment random component.
- Prefixes: `ws` (workspace), `ln` (lane), `ss` (session), `tm` (terminal), `rn` (run), `cor` (correlation).
- Format: `{prefix}_{ulid}` — all lowercase prefix, underscore separator, uppercase Crockford base32 ULID.
- Zero runtime dependencies: no imports from node_modules.

### Parallel Opportunities
- T006 can proceed once T003/T004/T005 APIs are stable.

### Dependencies
- None. This is a leaf dependency.

### Risks & Mitigations
- Risk: self-contained ULID has subtle monotonicity bugs.
- Mitigation: exhaustive same-millisecond ordering tests.

---

## Work Package WP02: Cross-Repo Compatibility, Parsing, and Tests (Priority: P1)

**Phase**: Phase 2 - Integration
**Goal**: Configure package for cross-repo consumption, add collision resistance tests at scale, add microbenchmarks, and validate cross-repo parsing compatibility.
**Independent Test**: Package imports correctly in external project; 10M collision test passes; benchmarks meet SLO.
**Prompt**: `/kitty-specs/005-id-standards-and-cross-repo-coordination/tasks/WP02-cross-repo-compatibility-parsing-and-tests.md`
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [ ] T007 Configure package.json for cross-repo consumption (exports, types, zero deps) in `packages/ids/package.json`
- [ ] T008 [P] Add 10M collision resistance test across concurrent contexts in `packages/ids/tests/`
- [ ] T009 [P] Add microbenchmarks for generation (<0.01ms) and validation (<0.005ms) in `packages/ids/tests/bench/`
- [ ] T010 [P] Add format compliance test: all generated IDs match regex `^[a-z]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$` in `packages/ids/tests/`

### Implementation Notes
- Package exports: `generateId`, `validateId`, `parseId`, `EntityType`, `PrefixRegistry`.
- Cross-repo: thegent, trace, heliosHarness import this package.
- tsconfig: strict mode, declaration files emitted.
- Collision test: use `Promise.all` with 8 concurrent generators producing 1.25M IDs each.

### Parallel Opportunities
- T008, T009, and T010 can all proceed in parallel once T007 package config is done.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: package config incompatible with other repos' build systems.
- Mitigation: test import in a minimal Bun project outside heliosApp.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel.
- **MVP Scope**: WP01 is P0 (leaf dependency for all other specs); WP02 is P1.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Self-contained ULID generation | WP01 | P0 | No |
| T002 | Prefix registry | WP01 | P0 | No |
| T003 | generateId public API | WP01 | P0 | No |
| T004 | validateId with integrity checks | WP01 | P0 | No |
| T005 | parseId extracting type + timestamp | WP01 | P0 | No |
| T006 | Generation/validation/parsing unit tests | WP01 | P0 | Yes |
| T007 | Package.json cross-repo config | WP02 | P1 | No |
| T008 | 10M collision resistance test | WP02 | P1 | Yes |
| T009 | Generation/validation microbenchmarks | WP02 | P1 | Yes |
| T010 | Format compliance regex test | WP02 | P1 | Yes |
