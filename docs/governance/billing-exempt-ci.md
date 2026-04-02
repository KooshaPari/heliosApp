# Billing-Exempt CI Policy

The only acceptable CI exception class is billed or quota-constrained infrastructure that is not
required for ordinary PR merge safety.

## Merge Rule

- All non-billing PR checks must pass before merge.
- Any billing-only exception must be stated in the PR body.
- Use a dedicated label such as `ci-billing-exception` when a billing-only exception is active.

## Non-Exempt Checks

- `policy-gate`
- `Lint and Format`
- `Build`
- `Type Check`
- `guard`

Security scanning may remain advisory until the repo promotes specific jobs into the protected
required-check list.
