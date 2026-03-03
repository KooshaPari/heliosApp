# heliosApp — CLAUDE.md

## Project Overview

heliosApp is a TypeScript monorepo for the Helios desktop application platform. It uses Bun as the runtime and package manager (`bun@1.2.20`), with pnpm-style workspace layout.

### Repository Structure

```
apps/
  runtime/        Core runtime: providers, recovery, protocol, PTY, lanes
  desktop/        Desktop application shell
  renderer/       Renderer / UI layer (SolidJS)
packages/
  ids/            Shared identifier utilities
docs/             VitePress documentation site
scripts/          DevOps and governance helper scripts
.github/          CI workflows and required-checks config
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `Taskfile.yml` | Task runner for quality gates, CI, devops |
| `.oxlintrc.json` | Oxc linter rules |
| `.oxfmtrc.json` | Oxc formatter rules |
| `tsconfig.json` / `tsconfig.base.json` | TypeScript project references |
| `bunfig.toml` | Bun configuration |
| `playwright.config.ts` | E2E test configuration |

---

## Build, Lint, and Test Commands

### Quick Reference

```bash
# Install dependencies (frozen lockfile)
bun install --frozen-lockfile

# Type-check
bun run typecheck          # tsc --noEmit

# Lint (Oxlint)
bun run lint               # oxlint -c .oxlintrc.json apps docs/.vitepress
bun run lint:type-aware    # oxlint with --type-aware for apps/runtime + desktop

# Format (Oxfmt)
bun run format             # oxfmt --write
bun run format:check       # oxfmt --check (CI mode)

# Unit tests (Bun test runner)
bun run test               # apps/runtime + apps/desktop/tests/unit
bun run test:coverage      # with coverage

# E2E tests (Playwright)
bun run test:e2e           # full Playwright suite
```

### Taskfile Quality Lanes

The `Taskfile.yml` orchestrates composite quality gates. Use `task <name>`:

| Task | What it runs |
|------|-------------|
| `task quality:quick` | preflight + deps + typecheck + lint + test |
| `task quality:strict` | quality:quick + coverage + docs:build |
| `task check` | alias for quality:strict |
| `task ci` | check + docs:index + docs:validate |
| `task test:e2e` | Playwright install + build + e2e gate |

DevOps helpers:

| Task | Purpose |
|------|---------|
| `task devops:status` | git status, remotes, recent log |
| `task devops:check` | repo health checks (no CI) |
| `task devops:check:ci` | repo health checks + CI lane |
| `task devops:push` | push with fallback remote handling |

---

## TypeScript Patterns

- **Module system**: ESM (`"type": "module"` in package.json).
- **Strict mode**: Use `tsc --noEmit` for type-checking; do not rely on Bun's loose type handling.
- **Project references**: `tsconfig.base.json` is extended by per-app `tsconfig.json` files.
- **UI framework**: SolidJS in `apps/renderer/`.
- **Test framework**: Bun's built-in test runner (`bun test`) for unit tests; Playwright for E2E.
- **DOM mocking**: happy-dom for unit tests requiring DOM APIs.

### Oxc Toolchain (not Biome)

This repo uses **Oxlint** and **Oxfmt** (the Oxc toolchain), not Biome. Commands:

- Lint: `oxlint -c .oxlintrc.json <paths>`
- Format: `oxfmt --write <paths>` / `oxfmt --check <paths>`
- Config files: `.oxlintrc.json`, `.oxfmtrc.json`
- The `oxlint-tsgolint` plugin provides additional TS-aware rules.

---

## Worktree Discipline

### Canonical Folder (`repos/heliosApp/`)

The canonical folder tracks `main`. Permitted operations:

- Reading and reviewing code
- `git pull origin main`
- Merge or cherry-pick integration after approval
- Verification checks (read-only)

**Prohibited in canonical**: feature commits, long-lived branches, stacked branch creation.

### Worktree Location

```
repos/heliosApp-wtrees/
  ├── <topic>/          # Feature branch workspace
  └── <topic>/          # Another feature workspace
```

### Worktree Workflow

```bash
# Create
git worktree add ../heliosApp-wtrees/<topic> -b <topic>
cd ../heliosApp-wtrees/<topic>
bun install --frozen-lockfile

# Develop, test, push
task quality:quick
git push -u origin <topic>

# Open PR targeting main, pass all checks, get review

# Integrate (in canonical folder)
git pull origin main
# PR merge via GitHub
```

### Activities That Must Use Worktrees

- Feature implementation and commits
- Test writing and execution
- Quality gate runs and CI verification
- PR preparation and documentation
- Analysis, experimentation, performance testing

---

## Quality Gates and CI

### Pre-merge Requirements

1. **Type-check**: `bun run typecheck` passes
2. **Lint**: `bun run lint` passes (Oxlint)
3. **Format**: `bun run format:check` passes (Oxfmt)
4. **Tests**: `bun run test` passes
5. **E2E** (when applicable): `task test:e2e` passes
6. **Code review**: Approved with all threads resolved
7. **CI workflows**: All required checks green (see `.github/required-checks.txt`)

### CI Workflows (`.github/workflows/`)

- `policy-gate.yml` — PR policy enforcement
- `lint-test.yml` — Lint + test on PR events
- Build and security workflows as configured

Do not merge while any check is failing unless the user gives explicit exception approval.

---

## Commit Messages

```
<type>: <subject>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

- Subject: lowercase, imperative mood, no trailing period, max 50 chars
- Body (optional): explain what and why, wrap at 72 chars
- Footer: `Fixes #123`, `BREAKING CHANGE: ...`

---

## Governance Protocols

### Cross-Project Reuse (Phenotype Org)

- Identify sharable, modularizable code during implementation.
- Prefer extraction into existing shared modules; propose new shared modules when none fit.
- Execute forward-only migrations: extract, update callers, remove local duplicates.

### Git and Delivery

- Branch-based delivery with pull requests; no direct default-branch writes.
- Prefer stacked PRs for multi-part changes (one concern per PR).
- Rebase/restack to stay current with target branch.
- Enforce CI strictly; surface blockers explicitly.

### Long-Term Stability

- Prefer `stable_solution` over `quick_fix`.
- Prefer targeted edits and forward fixes over deletions/reversions.
- Archive obsolete material to `.archive/` rather than deleting.
- Prefer clean manual merges over force merges or history-destructive workflows.
- Complete unused stubs into production quality when they represent intended direction.

### Child Agent Policy

- Use child agents for scoped discovery, audits, multi-repo scans, and implementation planning.
- Keep parent-agent changes focused on integration and finalization.

---

## Troubleshooting

- **Bun version mismatch**: Ensure `bun --version` matches `packageManager` field in `package.json`.
- **Lockfile drift**: Run `bun install --frozen-lockfile`; if it fails, regenerate with `bun install` in a worktree.
- **Oxlint errors**: Check `.oxlintrc.json` for rule overrides; run `bun run lint` to reproduce.
- **Type errors**: Run `bun run typecheck` to get full diagnostics; check `tsconfig.base.json` for shared settings.
- **E2E failures**: Ensure Playwright browsers are installed: `bunx playwright install --with-deps chromium`.
