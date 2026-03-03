# Colab Toolchain Modernization

## Overview

Align the co(lab) fork (kooshapari/colab) with Phenotype organization toolchain standards. This consolidates six workstreams: task runner adoption, npm-to-bun migration, dependency cleanup, quality lane hierarchy, a base project constitution, and an inference engine evaluation for replacing the vendored llama.cpp C++ toolchain with Apple-native MLX.

## Motivation

Co(lab) currently uses ad-hoc npm scripts with no task runner, mixed npm/bun references across CI and documentation, unused dependencies inflating the 601MB node_modules, and no codified project governance. Every other Phenotype TypeScript repo (heliosApp, cliproxyapi++, 4sgm, thegent, trace) already uses Taskfile.yml, Biome, and a consistent quality lane pattern. This spec brings co(lab) into alignment so contributors and agents can use the same workflows across all repos.

The vendored llama.cpp inference backend requires a C++ toolchain (cmake + zig) adding build complexity. Apple's MLX framework offers ~53% faster inference on Apple Silicon via unified memory and eliminates the C++ dependency for the primary platform.

## Actors

- **Developer**: Runs quality gates locally, authors features, reviews PRs
- **CI system**: Runs non-mutating quality checks on PRs, release validation
- **Agent (Claude Code / helios)**: Executes task runner commands in worktrees
- **End user**: Benefits from faster inference (MLX) on Apple Silicon hardware

## User Scenarios

### S1: Developer runs quality checks locally
A developer clones the repo, runs `task quality`, and gets formatting fixes, lint checks, and test results in one command. They run `task quality:quick` for a fast readonly check before committing.

### S2: CI validates a pull request
The CI workflow calls `task quality:ci` which runs all checks without mutating files. If checks pass, the PR is mergeable. Release PRs additionally run `task quality:release-lint`.

### S3: Agent executes standard workflows
An agent in a worktree runs `task dev`, `task build`, `task test`, or `task quality` — the same commands available in every Phenotype repo. No npm fallbacks exist.

### S4: Developer consults the constitution
A new contributor reads `CONSTITUTION.md` to understand non-negotiable toolchain decisions (bun runtime, Biome formatting, vitest testing, Taskfile task runner) before making architectural choices.

### S5: Inference runs on Apple Silicon
The app loads a local model using MLX on macOS Apple Silicon. On non-Apple platforms, it falls back to llama.cpp. No C++ toolchain is required for the primary (macOS) build path.

## Functional Requirements

### FR1: Taskfile.yml adoption
- A `Taskfile.yml` exists at repo root with tasks: `dev`, `build`, `test`, `quality`, `quality:quick`, `quality:ci`, `quality:pre-push`, `quality:release-lint`
- `quality` runs: `quality:fmt` (Biome format --write), `quality:test` (vitest), `quality:lint` (Biome lint)
- `quality:quick` runs readonly checks (Biome check, vitest --run)
- `quality:ci` runs non-mutating checks suitable for CI (no --write flags)
- `quality:pre-push` is suitable for git pre-push hook integration
- `check` is an alias for `quality` (backward compatibility with existing muscle memory)

### FR2: npm to bun migration
- All `npm run` references in package.json scripts are replaced with `bun run` equivalents or removed in favor of Taskfile tasks
- CI workflow (.github/workflows/) uses `bun install` and `bun run` (or `task` commands) instead of `npm`
- README and documentation reference `bun` and `task` commands, not `npm`
- The `push:*` scripts in package.json that use `npm` are migrated to bun or Taskfile tasks
- No `npm` references remain in any project file

### FR3: Dependency cleanup
- `ansi-to-html` is removed (confirmed unused)
- `fs-extra` usage is replaced with bun-native filesystem APIs (`Bun.write`, `Bun.file`, `fs/promises`)
- No new dependencies are added that duplicate bun built-in capabilities

### FR4: Quality lane hierarchy
- The quality lane structure matches clipproxyapi++ pattern:
  - `quality` = canonical full check (fmt + test + lint, mutating)
  - `quality:quick` = fast readonly (no file writes)
  - `quality:ci` = non-mutating PR gate
  - `quality:release-lint` = release validation (changelog, version, tag checks)
  - `quality:pre-push` = git hook target
- `check` aliases `quality` for backward compatibility

### FR5: Base project constitution
- A `CONSTITUTION.md` file exists at repo root
- Documents non-negotiable decisions: runtime (bun + ElectroBun), test framework (vitest), formatter/linter (Biome, lineWidth: 100), task runner (Taskfile.yml / go-task), quality lane naming convention
- Documents library preferences and when to prefer bun builtins over npm packages
- Documents architecture principles (feature flags, RPC patterns, worktree discipline)
- Includes performance targets where applicable

### FR6: MLX inference evaluation
- Document the evaluation of MLX vs llama.cpp for local inference
- Define the integration surface: which files/modules interact with the inference backend
- Specify the fallback strategy: MLX primary on Apple Silicon, llama.cpp fallback on other platforms
- Identify the migration path: what changes are needed to swap from llama.cpp to MLX
- This requirement produces a design document / ADR, not necessarily a code change in this feature

## Non-Functional Requirements

- All existing 178 vitest tests continue to pass after migration
- Build succeeds without npm
- CI pipeline runs without npm installation step
- Taskfile.yml is compatible with go-task v3.x (current stable)
- Constitution is concise (under 200 lines) and actionable

## Assumptions

- go-task is available in CI runners (installable via standard install script)
- Biome is already configured in the repo (biome.json exists)
- The llama.cpp vendored build is in a known location that can be identified during implementation
- MLX evaluation is scoped to Apple Silicon macOS; Linux/Windows use llama.cpp

## Success Criteria

- A developer can run `task quality` and get full formatting, linting, and test results in one command
- Zero `npm` references remain in the repository
- CI passes using only `bun` and `task` commands
- The project constitution accurately reflects the repo's toolchain decisions and is consistent with sibling Phenotype repos
- The MLX evaluation ADR documents performance characteristics, migration effort, and fallback strategy
- All 178 existing tests pass after migration

## Dependencies

- go-task v3.x
- Biome (already present)
- bun (already the runtime)
- vitest (already configured)

## Out of Scope

- Actually implementing the MLX inference swap (this spec only evaluates and documents the path)
- vLLM integration (server-only, not suitable for desktop)
- Changes to ElectroBun's build system
- Migrating other Phenotype repos (they already conform)
