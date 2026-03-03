#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_HELPER_DIR="${PHENOTYPE_DEVOPS_REPO_ROOT:-$REPO_ROOT/../agent-devops-setups}"
DEFAULT_PUSH_HELPER="$SHARED_HELPER_DIR/scripts/repo-push-fallback.sh"
SHARED_HELPER="${PHENOTYPE_DEVOPS_PUSH_HELPER:-$DEFAULT_PUSH_HELPER}"

log() {
  printf '[push] %s\n' "$*"
}

run_push() {
  local remote="$1"
  local ref="$2"
  shift 2
  local push_flags=( "$@" )
  GIT_TERMINAL_PROMPT=0 git push "${push_flags[@]}" "$remote" "$ref"
}

is_local_path_remote() {
  local remote_url="$1"
  remote_url="${remote_url#file://}"
  case "$remote_url" in
    /*|./*|../*) return 0 ;;
    [A-Za-z]:*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_local_remote_ready() {
  local remote_url="$1"
  local normalized_remote="${remote_url#file://}"

  if ! is_local_path_remote "$remote_url"; then
    return 0
  fi

  if [[ ! -d "$normalized_remote" ]]; then
    log "Fallback remote path not found: $normalized_remote"
    return 1
  fi

  local objects_dir="${normalized_remote}/objects"
  local tmp_dir="${ORIGIN_OBJECTS_TMP_DIR:-$objects_dir/.tmp}"

  if [[ ! -d "$objects_dir" ]]; then
    log "Fallback remote objects path missing: $objects_dir"
    return 1
  fi
  if ! mkdir -p "$tmp_dir"; then
    log "Cannot create fallback temp dir: $tmp_dir"
    return 1
  fi

  if [[ ! -w "$tmp_dir" ]]; then
    log "Fallback temp dir is not writable: $tmp_dir"
    return 1
  fi

  return 0
}

require_value() {
  local flag="$1"
  if (($# < 2)); then
    echo "Missing value for ${flag}" >&2
    echo "Usage: ./scripts/push-heliosapp-with-fallback.sh [--skip-primary] [--primary-remote upstream] [--fallback-remote origin] [branch]" >&2
    exit 1
  fi
}

PRIMARY_REMOTE="${PHENOTYPE_PUSH_PRIMARY_REMOTE:-upstream}"
FALLBACK_REMOTE="${PHENOTYPE_PUSH_FALLBACK_REMOTE:-origin}"
DRY_RUN="${PHENOTYPE_PUSH_DRY_RUN:-0}"
SKIP_PRIMARY="${PHENOTYPE_PUSH_SKIP_PRIMARY:-0}"
ORIGIN_OBJECTS_TMP_DIR="${PHENOTYPE_PUSH_FALLBACK_TMP_DIR:-}"
BRANCH="${GIT_BRANCH:-}"

while (($#)); do
  case "$1" in
    --repo-root)
      require_value "$1" "$#"
      shift
      REPO_ROOT="$1"
      ;;
    --primary-remote)
      require_value "$1" "$#"
      shift
      PRIMARY_REMOTE="$1"
      ;;
    --fallback-remote)
      require_value "$1" "$#"
      shift
      FALLBACK_REMOTE="$1"
      ;;
    --skip-primary)
      SKIP_PRIMARY=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --origin-objects-tmp-dir)
      require_value "$1" "$#"
      shift
      ORIGIN_OBJECTS_TMP_DIR="$1"
      ;;
    --help|-h)
      echo "Usage: ./scripts/push-heliosapp-with-fallback.sh [--skip-primary] [--primary-remote upstream] [--fallback-remote origin] [branch]"
      exit 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      BRANCH="$1"
      ;;
  esac
  shift
done

if [[ -x "$SHARED_HELPER" ]]; then
  log "Using shared helper: $SHARED_HELPER"
  exec "$SHARED_HELPER" --repo-root "$REPO_ROOT" "$@"
else
  log "Shared helper unavailable. Using local fallback push flow."
fi

if ! cd "$REPO_ROOT"; then
  echo "Cannot enter repo root: $REPO_ROOT" >&2
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if (( DRY_RUN == 1 )); then
  log "Dry-run mode enabled"
  run_push_with_flag() {
    local remote="$1"
    local ref="$2"
    shift 2
    local push_flags=( "$@" )
    log "[DRY-RUN] git push ${push_flags[*]:-} ${remote} ${ref}"
  }
else
  run_push_with_flag() {
    local remote="$1"
    local ref="$2"
    shift 2
    run_push "$remote" "$ref" "$@"
  }
fi

log "Push branch: $BRANCH"
log "Primary remote: $PRIMARY_REMOTE"
log "Fallback remote: $FALLBACK_REMOTE"

git status --short --branch
log "Latest commits:"
git log --oneline -n 5

if (( SKIP_PRIMARY == 0 )); then
  log "Attempting push to $PRIMARY_REMOTE"
  if run_push_with_flag "$PRIMARY_REMOTE" "$BRANCH"; then
    log "Primary push succeeded"
    exit 0
  fi
  log "Primary push failed. Trying fallback remote."
fi

fallback_url="$(git remote get-url "$FALLBACK_REMOTE")"
if [[ -z "$fallback_url" ]]; then
  echo "Fallback remote '$FALLBACK_REMOTE' is not configured." >&2
  exit 1
fi

if ! ensure_local_remote_ready "$fallback_url"; then
  echo "Fallback remote pre-check failed: $fallback_url" >&2
  exit 1
fi

log "Attempting push to $FALLBACK_REMOTE"
if ! run_push_with_flag "$FALLBACK_REMOTE" "$BRANCH"; then
  echo "Fallback push failed." >&2
  exit 1
fi

log "Fallback push succeeded."
