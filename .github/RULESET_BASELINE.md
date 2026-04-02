# heliosApp Ruleset Baseline

This repository needs strict protected-branch rules because it already has active PR traffic and
branch-facing CI.

GitHub rulesets for protected branches should require:

- pull request required before merge
- no force push
- no branch deletion
- linear history
- `CODEOWNERS` review
- conversation resolution before merge
- required checks:
  - `policy-gate`
  - `pr-governance-gate`
  - `guard`
  - `Semgrep Scan`
  - `Secret Scanning`

## Branch Policy

- `stack/*`, `layer/*`, `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `ci/*`, and `chore/*` are
  valid PR head branches.
- `fix/*` must not target `main` or `master` unless the PR carries `layered-pr-exception`.
- Merge commits in PR branches are disallowed.
- Local `--no-verify` is not an accepted reason to bypass server-side workflow checks.

## Exception Policy

- Only documented billing or quota failures may be excluded from required checks.
- Billing exceptions require the `ci-billing-exception` label and an explicit PR body note.
- Review threads and blocking comments must be resolved before merge.
