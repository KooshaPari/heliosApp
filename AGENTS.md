# Agent Context

## Active Technologies
- Pending update by agileplus agent context tooling.

- TypeScript (TS-native track, Bun runtime), Python 3.14+/PyPy 3.11 for supporting tooling where needed + Bun, runtime protocol bus in `apps/runtime/src/protocol/`, Codex CLI integration, `cliproxyapi++` harness bridge (001-colab-agent-terminal-control-plane)
- In-memory for this vertical slice (Codex session IDs used for continuity); durable persistence deferred to later increment (001-colab-agent-terminal-control-plane)
## Recent Changes
- 001-colab-agent-terminal-control-plane: Added TypeScript (TS-native track, Bun runtime), Python 3.14+/PyPy 3.11 for supporting tooling where needed + Bun, runtime protocol bus in `apps/runtime/src/protocol/`, Codex CLI integration, `cliproxyapi++` harness bridge
- Pending update by agileplus agent context tooling.
<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->


## Review Bot Governance

- Keep CodeRabbit PR blocking at the lowest level in `.coderabbit.yaml`: `pr_validation.block_on.severity: info`.
- Keep Gemini Code Assist severity at the lowest level in `.gemini/config.yaml`: `code_review.comment_severity_threshold: LOW`.
- Retrigger commands:
  - CodeRabbit: comment `@coderabbitai full review` on the PR.
  - Gemini Code Assist (when enabled in the repo): comment `@gemini-code-assist review` on the PR.
  - If comment-trigger is unavailable, retrigger both bots by pushing a no-op commit to the PR branch.
- Rate-limit discipline:
  - Use a FIFO queue for retriggers (oldest pending PR first).
  - Minimum spacing: one retrigger comment every 120 seconds per repo.
  - On rate-limit response, stop sending new triggers in that repo, wait 15 minutes, then resume queue processing.
  - Do not post duplicate trigger comments while a prior trigger is pending.


## Phenotype Org Cross-Project Reuse Protocol <!-- PHENOTYPE_SHARED_REUSE_PROTOCOL -->

- Treat this repository as part of the broader Phenotype organization project collection, not an isolated codebase.
- During research and implementation, actively identify code that is sharable, modularizable, splittable, or decomposable for reuse across repositories.
- When reusable logic is found, prefer extraction into existing shared modules/projects first; if none fit, propose creating a new shared module/project.
- Include a `Cross-Project Reuse Opportunities` section in plans with candidate code, target shared location, impacted repos, and migration order.
- For cross-repo moves or ownership-impacting extractions, ask the user for confirmation on destination and rollout, then bake that into the execution plan.
- Execute forward-only migrations: extract shared code, update all callers, and remove duplicated local implementations.
## Phenotype Git and Delivery Workflow Protocol <!-- PHENOTYPE_GIT_DELIVERY_PROTOCOL -->

- Use branch-based delivery with pull requests; do not rely on direct default-branch writes where rulesets apply.
- Prefer stacked PRs for multi-part changes so each PR is small, reviewable, and independently mergeable.
- Keep PRs linear and scoped: one concern per PR, explicit dependency order for stacks, and clear migration steps.
- Enforce CI and required checks strictly: do not merge until all required checks and policy gates are green.
- Resolve all review threads and substantive PR comments before merge; do not leave unresolved reviewer feedback.
- Follow repository coding standards and best practices (typing, tests, lint, docs, security) before requesting merge.
- Rebase or restack to keep branches current with target branch and to avoid stale/conflicting stacks.
- When a ruleset or merge policy blocks progress, surface the blocker explicitly and adapt the plan (for example: open PR path, restack, or split changes).
## Phenotype Long-Term Stability and Non-Destructive Change Protocol <!-- PHENOTYPE_LONGTERM_STABILITY_PROTOCOL -->

- Optimize for long-term platform value over short-term convenience; choose durable solutions even when implementation complexity is higher.
- Classify proposed changes as `quick_fix` or `stable_solution`; prefer `stable_solution` unless an incident response explicitly requires a temporary fix.
- Do not use deletions/reversions as the default strategy; prefer targeted edits, forward fixes, and incremental hardening.
- Prefer moving obsolete or superseded material into `.archive/` over destructive removal when retention is operationally useful.
- Prefer clean manual merges, explicit conflict resolution, and auditable history over forceful rewrites, force merges, or history-destructive workflows.
- Prefer completing unused stubs into production-quality implementations when they represent intended product direction; avoid leaving stubs ignored indefinitely.
- Do not merge any PR while any check is failing, including non-required checks, unless the user gives explicit exception approval.
- When proposing a quick fix, include a scheduled follow-up path to a stable solution in the same plan.
## Child-Agent and Delegation Policy
- Use child agents liberally for scoped discovery, audits, multi-repo scans, and implementation planning before direct parent-agent edits.
- Prefer delegating high-context or high-churn tasks to subagents, and keep parent-agent changes focused on integration and finalization.
- Reserve parent-agent direct writes for the narrowest, final decision layer.
