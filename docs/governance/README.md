# heliosApp Governance Baseline

This directory is the repo-local governance surface for `heliosApp`.

## Protected Branch Policy

- PRs are required for the default branch.
- Force pushes and branch deletion are disallowed on protected branches.
- At least one approval is required before merge.
- Review threads must be resolved before merge.
- Stacked PR lanes are allowed; direct `fix/* -> main` requires `layered-pr-exception`.

## Canonical Files

- `.github/rulesets/main.json`
- `.github/RULESET_BASELINE.md`
- `.github/CODEOWNERS`
- `.github/required-checks.json`
- `.github/pull_request_template.md`
- `.github/workflows/policy-gate.yml`
- `.github/workflows/pr-governance-gate.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/security-guard.yml`

## Current Billing Policy

Use [billing-exempt-ci.md](/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/docs/governance/billing-exempt-ci.md)
for the only acceptable CI exception class.
