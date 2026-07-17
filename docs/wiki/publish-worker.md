# Publish Worker and Queue Lane

This repo uses a shared push helper for normal publishing. A local queue mode is available for environments that cannot perform network writes in the current session (for example sandboxed CI helpers).

## Why queue mode

`--queue-only` stores a push request in `.git/push-queue.ndjson` instead of calling remotes immediately.
This allows a non-sandboxed worker (or a later session) to execute pushes with full network access.

## Queue usage

```bash
# Enqueue current branch
task devops:push:queue
task devops:push:queue -- --dry-run

# Enqueue an explicit branch/remotes
./scripts/push-heliosapp-with-fallback.sh --queue-only main --primary-remote upstream --fallback-remote origin
```

## Drain queue

```bash
# Drain queued requests from the current repo
task devops:push:drain-queue
./scripts/push-heliosapp-with-fallback.sh --drain-queue
```

## Related shared helpers

- `../agent-devops-setups/scripts/repo-push-fallback.sh`
- `../agent-devops-setups/scripts/repo-devops-checker.sh`
- `../portage/scripts/push-portage-with-fallback.sh` (sibling baseline push pattern)
- `../thegent/scripts/push-thegent-with-fallback.sh` (sibling baseline push pattern)

Set env overrides only when needed:

- `PHENOTYPE_DEVOPS_PUSH_HELPER` / `PHENOTYPE_DEVOPS_CHECKER_HELPER`
- `PHENOTYPE_PUSH_QUEUE_FILE`
- `PHENOTYPE_PUSH_FALLBACK_TMP_DIR`

## Notes

- Queue entries are tab-separated and currently include context + branch/remotes.
- Dry-run queue entries are kept for manual audit.
- For regular pushes on a healthy networked environment, keep using normal `devops:push` flow.
