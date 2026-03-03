# Workspace Rules

## Child Agent Usage

The repo uses child agents for focused audits, multi-file policy sweeps, and parallelized implementation tasks. Use the same protocol for delegated lanes and close with explicit status outputs.

## Overview
This document defines the governance and operational guidelines for the heliosApp repository (TypeScript runtime application).

## Key Principles
- Canonical folders track `main` exclusively
- Feature work uses dedicated worktree directories
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
1. Feature work: Use `repo-wtrees/<topic>/` directory
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
repo-wtrees/
  ├── topic-1/               # Feature branch workspace
  │   ├── .git -> ../repo/.git
  │   └── [feature content]
  └── topic-2/               # Another feature workspace
      └── [feature content]
```

## Using Worktrees

### Create a Worktree
```bash
git worktree add ../repo-wtrees/<topic> -b <topic>
cd ../repo-wtrees/<topic>
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
   git worktree add ../repo-wtrees/feature-xyz -b feature/xyz
   cd ../repo-wtrees/feature-xyz
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
   git worktree remove ../repo-wtrees/feature-xyz
   ```

## Reverting Work
If work in a worktree needs to be discarded:
```bash
# Back in canonical folder
git worktree remove ../repo-wtrees/feature-xyz
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
git worktree remove ../repo-wtrees/<topic>
git worktree add ../repo-wtrees/<topic> -b <topic>
```

### "Branch already exists on origin"
```bash
git push -u origin <topic> --force  # Only if you control the branch
```

### "Cannot delete worktree, it's dirty"
```bash
cd ../repo-wtrees/<topic>
git restore .
git clean -fd
cd ../../repo
git worktree remove ../repo-wtrees/<topic>
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
