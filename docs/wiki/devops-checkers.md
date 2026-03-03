# DevOps Checkers and Release Gates

This page is the VitePress index for all production gates, checker scripts, and command aliases used by this repository.

## Live Check Surface

| Checker | Scope | Trigger | Command |
| --- | --- | --- | --- |
| preflight | Tool/version/runtime prerequisites | Local dev | `task preflight` or `just preflight` |
| quality:quick | Typecheck, lint, unit tests | Local validation | `task quality:quick` or `just quality-quick` |
| quality:strict | quality:quick + coverage + docs build | CI parity | `task quality:strict` or `just quality-strict` |
| check | canonical full check | Local/release | `task check` |
| ci | strict + docs index refresh | Release candidate validation | `task ci` or `just ci` |
| devops:check | shared helper checks | Pre-merge/deploy checks | `task devops:check` or `just devops-check` |
| devops:check:ci | includes ci lane checks | Release/branch validation | `task devops:check:ci` or `just devops-check-ci` |
| devops:check:ci-summary | includes json summary artifact | Handoff + audit evidence | `task devops:check:ci-summary` or `just devops-check-ci-summary` |
| devops-status | repo state and remotes | pre-push smoke | `task devops:status` or `just devops-status` |

## GitHub workflow gates

- `.github/workflows/ci.yml`
- `.github/workflows/policy-gate.yml`
- `.github/workflows/required-check-names-guard.yml`
- `.github/workflows/agent-dir-guard.yml`
- `.github/workflows/vitepress-pages.yml`

Keep gate names in `.github/required-checks.txt` aligned with workflow `name:` values.

## Push and Queue Worker Gates

- Primary path: `scripts/push-heliosapp-with-fallback.sh`
- Shared helper path override:
  - `PHENOTYPE_DEVOPS_REPO_ROOT`
  - `PHENOTYPE_DEVOPS_PUSH_HELPER`
  - `PHENOTYPE_DEVOPS_CHECKER_HELPER`

Common queue commands:

- `./scripts/push-heliosapp-with-fallback.sh --queue-only`
- `./scripts/push-heliosapp-with-fallback.sh --drain-queue`

Cheat-sheet:

- `just devops-push` = local/shared helper push with automatic fallback
- `just devops-push-origin` = push to fallback remote only
- `just devops-push-queue` = queue push request when remote path is blocked
- `just devops-push-drain-queue` = replay queued push requests

Bot review triggers and cooldown:

- CodeRabbit: `@coderabbitai full review` (minimum 120s spacing)
- Gemini Assist: `@gemini-code-assist review` (minimum 120s spacing)
- If rate-limited: pause 15 minutes before the next trigger in that repo.

Persistent queue failure remediation:

1. Drain in dry-run first:
   - `./scripts/push-heliosapp-with-fallback.sh --json --drain-queue --dry-run`
2. Identify repeated `dns_network` or `object_tmp_dir` reasons.
3. For `object_tmp_dir`, create writable temp dirs and rerun with queue replay.
4. For `dns_network`, run from a network-stable network path and rerun queue.
5. If queue never clears, keep only unresolved entries and open a follow-up lane.

## Task/Just Parity

| task | just alias | behavior |
| --- | --- | --- |
| `task preflight` | `just preflight` | tool checks |
| `task docs:index` | `just docs-index` | generate docs index |
| `task docs:validate` | `just docs-validate` | validate session/docs links |
| `task quality:strict` | `just quality-strict` | strict quality lane |
| `task ci` | `just ci` | strict + docs updates |
| `task devops:check:ci-summary` | `just devops-check-ci-summary` | strict + JSON summary |
| `task devops:push:origin` | `just devops-push-origin` | push fallback only |
| `task devops:push:queue` | `just devops-push-queue` | queue-only push |
| `task devops:push:drain-queue` | `just devops-push-drain-queue` | drain queue |

## Cross-repo context

- This repository uses shared Phenotype DevOps scripts through `agent-devops-setups` under the common workspace layout used by sibling repos.
- For shared policy changes, keep the same check naming contract so `required-checks` guard remains portable across repositories.

Cross-repo reference notes:

- Keep parity with sibling repos (`heliosCLI`, `heliosApp`, `cliproxyapi++`, `portage`) by mirroring checker naming in `.github/required-checks.txt` and `Taskfile.yml`.
- Use `docs/wiki/devops-checkers.md` as a shared template when adding checkers to sibling docs.
