#!/usr/bin/env bash
set -euo pipefail

# push-heliosapp-with-fallback.sh
# Pushes current branch to upstream/main first, then origin/main as fallback.
# Optional: set ORIGIN_OBJECTS_TMP_DIR when origin is a local airlock repo and needs manual temp dir creation.

branch="${1:-${GIT_BRANCH:-main}}"
origin_repo_tmp_dir="${ORIGIN_OBJECTS_TMP_DIR:-/Users/kooshapari/.airlock/repos/8711057fb661.git/objects/.tmp}"

if command -v git >/dev/null 2>&1; then
  :
else
  echo "git is required but not installed." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "" && "$current_branch" != "$branch" ]]; then
  echo "Switching from '$current_branch' to '$branch'."
  git checkout "$branch"
fi

echo "==> Current status"
git status --short --branch

echo "==> Remotes"
git remote -v

echo "==> Attempting push to upstream"
if git push upstream "$branch"; then
  echo "==> Upstream push succeeded"
else
  echo "==> Upstream push failed. Trying origin fallback"

  # Ensure local remote temp dir exists when origin is a local bare repo.
  if [[ -d /Users/kooshapari/.airlock/repos/ ]]; then
    mkdir -p "$origin_repo_tmp_dir"
  fi

  if git push origin "$branch"; then
    echo "==> Origin push succeeded"
  else
    echo "ERROR: both upstream and origin push failed." >&2
    echo "Manual follow-up:" >&2
    echo "  1) From networked host, run: git push upstream $branch" >&2
    echo "  2) If using origin: verify remote temp directory exists and writable:" >&2
    echo "     mkdir -p $origin_repo_tmp_dir" >&2
    echo "     chmod -R u+rwX $origin_repo_tmp_dir" >&2
    exit 1
  fi
fi

echo "==> Post-push status"
git status --short --branch

echo "==> Recent commits"
git log --oneline -n 5
