# Workspace Rules

## Overview
This document defines the governance and operational guidelines for the heliosApp repository (TypeScript runtime application).

## Key Principles
- Canonical folders track `main` exclusively
- Feature work uses dedicated `.worktrees` directories
- All quality gates and integration checks happen in worktrees before canonical merge
- Explicit approval gates prevent unreviewed code from reaching canonical `main`

---

# Branch Discipline

## Canonical Repository Constraints
- **Canonical folders** are working copies anchored to `main`
- Only these operations are permitted in canonical folders:
  - Reading and reviewing code
  - Verification checks and quality gates
  - Explicit `git pull origin main` (pulling latest from upstream)
  - Merge or cherry-pick operations after approval
- **Prohibited**: Long-lived feature branches, new feature commits, stacked branches

## Branch Tracking
- Check canonical branch status with:
  ```bash
  git status --short --branch
  ```
- Output should show: `## main` or `## main...origin/main`
- If branch is not `main`, switch back after completing integration tasks

## Integration Workflow
1. Feature work: Use `.worktrees/<topic>/` directory
2. Pull into canonical `main`: Only after approval and passing all checks
3. Integration methods: Explicit merge or cherry-pick operations
4. Return to canonical: Canonical folder returns to `main` after integration

---

# Worktree Rules

## Purpose
Worktrees isolate feature work, testing, and experimentation from canonical `main`.

## Directory Structure
```
repo/                          # Canonical folder (main-anchored)
.worktrees/
  ├── topic-1/               # Feature branch workspace
  │   ├── .git -> ../repo/.git
  │   └── [feature content]
  └── topic-2/               # Another feature workspace
      └── [feature content]
```

## Using Worktrees

### Create a Worktree
```bash
git worktree add ../.worktrees/<topic> -b <topic>
cd ../.worktrees/<topic>
git push -u origin <topic>
```

### Work in a Worktree
- Check branch: `git branch -v` (should show your feature branch)
- Make commits, push, open PR from the worktree
- Run tests, quality gates, and verification in the worktree
- All agent activity happens here: feature work, PR prep, testing, analysis

### Merge and Clean Up
```bash
# In canonical folder
git pull origin main
git merge origin/<topic>

# Back in worktree (optional)
git fetch origin
git reset --hard origin/main  # or delete worktree
```

## Worktree Activities
The following activities MUST run in worktrees (not canonical):
- Feature implementation
- Test writing and execution
- CI/CD pipeline verification
- Code quality checks
- PR preparation and documentation
- Analysis and experimentation
- Performance testing

---

# Quality Gates

## Pre-merge Checks
All of the following must pass before merging to canonical `main`:

### Policy Gate
- Run `phenotypeActions/actions/policy-gate` composite action
- Validates:
  - No merge commits in PR branch
  - PR follows naming conventions

### Linting and Testing
- Run `phenotypeActions/actions/lint-test` composite action
- TypeScript validation:
  - `biome check` (linting and code quality)
  - `vitest` (unit and integration tests)

### Code Review
- Minimum approval count (specify: e.g., 1, 2)
- Specific reviewers (if applicable)
- Automated checks (linters, security scans) must pass

### Security Checks
- Dependency vulnerability scanning
- Secret detection
- Code security analysis

## Continuous Integration Workflows
Document location: `.github/workflows/`

Standard workflows:
- `policy-gate.yml`: Enforces PR policies on PR events
- `lint-test.yml`: Runs TypeScript linting and vitest
- `build.yml`: Builds application bundles
- `security.yml`: Runs security checks
- (Additional workflows as needed)

### Workflow Triggers
- `pull_request`: Lint, test, security checks
- `push` to `main`: Build, deploy to staging
- `release` tags: Build, deploy to production
- Manual triggers: On-demand deployments, special checks

---

# Development Workflow

## Daily Development Cycle

1. **Start**: Create worktree from canonical `main`
   ```bash
   git worktree add ../.worktrees/feature-xyz -b feature/xyz
   cd ../.worktrees/feature-xyz
   ```

2. **Develop**: Make commits, push to feature branch
   ```bash
   git add .
   git commit -m "feat: implement XYZ"
   git push -u origin feature/xyz
   ```

3. **Test Locally**: Run quality gates in worktree
   ```bash
   # Install dependencies
   bun install

   # Run linting
   bun biome check .

   # Run tests
   bun vitest
   ```

4. **Open PR**: Create PR from feature branch
   - Target: `main`
   - Title: Clear, concise description
   - Description: Context, motivation, related issues

5. **Verify**: All CI/CD checks pass
   - Policy gate passes
   - Linting and tests pass
   - Security checks pass
   - Code review approved

6. **Merge**: Merge to canonical `main`
   ```bash
   # In canonical folder
   git pull origin main
   git merge origin/feature/xyz
   git push origin main
   ```

7. **Cleanup**: Remove worktree
   ```bash
   git worktree remove ../.worktrees/feature-xyz
   ```

## Reverting Work
If work in a worktree needs to be discarded:
```bash
# Back in canonical folder
git worktree remove ../.worktrees/feature-xyz
```

**WARNING**: Never run `git reset --hard`, `git restore .`, or `git clean -f` in canonical folders.

---

# Commit Message Guidelines

## Format
```
<type>: <subject>

<body>

<footer>
```

## Type
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no behavior change)
- `docs`: Documentation updates
- `test`: Test additions or updates
- `chore`: Build, dependencies, tooling
- `style`: Code style (formatting, no logic change)
- `perf`: Performance improvements

## Subject
- Lowercase
- Imperative mood ("add" not "adds" or "added")
- No period at end
- Max 50 characters

## Body
- Explain WHAT and WHY, not HOW
- Wrap at 72 characters
- Separate from subject with blank line

## Footer
- Reference related issues: `Fixes #123`, `Relates to #456`
- Document breaking changes: `BREAKING CHANGE: description`

## Example
```
fix: prevent race condition in parser

The parser was updating state while iterating, causing
inconsistent results when multiple threads accessed it.
Add mutex to protect critical section.

Fixes #789
```

---

# TypeScript Development

## Setup
- Runtime: Bun (all-in-one JavaScript/TypeScript runtime)
- Package Manager: bun
- Code Quality: Biome (lint + format)
- Testing: Vitest

## Installation
```bash
# Install dependencies
bun install

# Update dependencies
bun update
```

## Running Commands
```bash
# Lint and format
bun biome check .
bun biome format . --write

# Tests
bun vitest
bun vitest --run          # Single run (CI mode)

# Development server (if applicable)
bun run dev

# Build (if applicable)
bun run build
```

## Configuration Files
- `tsconfig.json`: TypeScript configuration
- `biome.json`: Biome linting and formatting rules
- `vitest.config.ts`: Vitest configuration
- `bunfig.toml`: Bun configuration

---

# Configuration and Secrets

## Environment Variables
Document required environment variables:
- `VAR_NAME`: Purpose, example value, where to set

## Local Configuration
- `.env` file handling (if applicable)
- Config file locations
- Sample config templates

## Secrets Management
- Where secrets are stored (GitHub Secrets, HashiCorp Vault, etc.)
- How to access secrets locally for development
- Security best practices

---

# Troubleshooting

## Worktree Issues

### "Worktree already exists"
```bash
git worktree remove ../.worktrees/<topic>
git worktree add ../.worktrees/<topic> -b <topic>
```

### "Branch already exists on origin"
```bash
git push -u origin <topic> --force  # Only if you control the branch
```

### "Cannot delete worktree, it's dirty"
```bash
cd ../.worktrees/<topic>
git restore .
git clean -fd
cd ../../repo
git worktree remove ../.worktrees/<topic>
```

## Bun / TypeScript Issues
- Check Bun version: `bun --version`
- Clear cache: `bun install --force`
- Check for conflicting global tools: `which node`, `which npm`

## CI/CD Issues
- Check GitHub Actions logs for detailed error messages
- Run quality gates locally before pushing
- Review policy-gate logs for PR policy violations

---

# Additional Resources

## Documentation
- Architecture overview: `docs/architecture.md`
- API reference: `docs/api.md`
- Contributing guide: `CONTRIBUTING.md`

## Related Repositories
- phenotypeActions (composite actions): `https://github.com/KooshaPari/phenotypeActions`
- template-commons (shared templates): `https://github.com/KooshaPari/template-commons`

## Tools and Commands
- Task runner: `bun` (all commands via `bun run <script>`)
- Package manager: `bun`
- TypeScript: Latest stable
- Biome: Latest stable

---

# Document Maintenance

## Last Updated
- Date: 2026-03-01
- Updated by: Claude Agent

## Review Schedule
- Review and update this document quarterly
- Update when significant process changes occur
- Keep in sync with team practices

## Child-Agent and Delegation Policy
- Use child agents liberally for scoped discovery, audits, multi-repo scans, and implementation planning before direct parent-agent edits.
- Prefer delegating high-context or high-churn tasks to subagents, and keep parent-agent changes focused on integration and finalization.
- Reserve parent-agent direct writes for the narrowest, final decision layer.

## Child Agent Usage
- Use child agents liberally for discovery-heavy, migration-heavy, and high-context work.
- Delegate broad scans, decomposition, and implementation waves to subagents before final parent-agent integration.
- Keep the parent lane focused on deterministic integration and finalization.
- Preserve explicit handoffs and cross-agent context in session notes and audits.

## CI Completeness Policy

- Always evaluate and fix ALL CI check failures on a PR, including pre-existing failures inherited from main.
- Never dismiss a CI failure as "pre-existing" or "unrelated to our changes" — if it fails on the PR, fix it in the PR.
- This includes: build, lint, test, docs build, security scanning (CodeQL), code review gates (CodeRabbit), workflow guard checks, and any other CI jobs.
- When a failure is caused by infrastructure outside the branch (e.g., rate limits, external service outages), implement or improve automated retry/bypass mechanisms in CI workflows.
- After fixing CI failures, verify locally where possible (build, vet, tests) before pushing.

## Phenotype Git and Delivery Workflow Protocol <!-- PHENOTYPE_GIT_DELIVERY_PROTOCOL -->

- Use branch-based delivery with pull requests; do not rely on direct default-branch writes where rulesets apply.
- Prefer stacked PRs for multi-part changes so each PR is small, reviewable, and independently mergeable.
- Keep PRs linear and scoped: one concern per PR, explicit dependency order for stacks, and clear migration steps.
- Enforce CI and required checks strictly: do not merge until all required checks and policy gates are green.
- Resolve all review threads and substantive PR comments before merge; do not leave unresolved reviewer feedback.
- Follow repository coding standards and best practices (typing, tests, lint, docs, security) before requesting merge.
- Rebase or restack to keep branches current with target branch and to avoid stale/conflicting stacks.
- When a ruleset or merge policy blocks progress, surface the blocker explicitly and adapt the plan (for example: open PR path, restack, or split changes).

## Phenotype Org Cross-Project Reuse Protocol <!-- PHENOTYPE_SHARED_REUSE_PROTOCOL -->

- Treat this repository as part of the broader Phenotype organization project collection, not an isolated codebase.
- During research and implementation, actively identify code that is sharable, modularizable, splittable, or decomposable for reuse across repositories.
- When reusable logic is found, prefer extraction into existing shared modules/projects first; if none fit, propose creating a new shared module/project.
- Include a `Cross-Project Reuse Opportunities` section in plans with candidate code, target shared location, impacted repos, and migration order.
- For cross-repo moves or ownership-impacting extractions, ask the user for confirmation on destination and rollout, then bake that into the execution plan.
- Execute forward-only migrations: extract shared code, update all callers, and remove duplicated local implementations.

## Phenotype Long-Term Stability and Non-Destructive Change Protocol <!-- PHENOTYPE_LONGTERM_STABILITY_PROTOCOL -->

- Optimize for long-term platform value over short-term convenience; choose durable solutions even when implementation complexity is higher.
- Classify proposed changes as `quick_fix` or `stable_solution`; prefer `stable_solution` unless an incident response explicitly requires a temporary fix.
- Do not use deletions/reversions as the default strategy; prefer targeted edits, forward fixes, and incremental hardening.
- Prefer moving obsolete or superseded material into `.archive/` over destructive removal when retention is operationally useful.
- Prefer clean manual merges, explicit conflict resolution, and auditable history over forceful rewrites, force merges, or history-destructive workflows.
- Prefer completing unused stubs into production-quality implementations when they represent intended product direction; avoid leaving stubs ignored indefinitely.
- Do not merge any PR while any check is failing, including non-required checks, unless the user gives explicit exception approval.
- When proposing a quick fix, include a scheduled follow-up path to a stable solution in the same plan.

## Worktree Discipline

- Feature work goes in `.worktrees/<topic>/`
- Legacy `PROJECT-wtrees/` and `repo-wtrees/` roots are for migration only and must not receive new work.
- Canonical repository remains on `main` for final integration and verification.

---

## AgilePlus Governance
- This repo uses AgilePlus for spec-driven development
- Feature specs live in `agileplus-specs/` (AgilePlus native format)
- Spec docs (PRD.md, ADR.md, FUNCTIONAL_REQUIREMENTS.md, PLAN.md) are maintained at repo root
- See the AgilePlus documentation for governance workflows
