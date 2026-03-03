#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_HELPER_DIR="${PHENOTYPE_DEVOPS_REPO_ROOT:-}"
QUEUE_FILE="${PHENOTYPE_PUSH_QUEUE_FILE:-$REPO_ROOT/.git/push-queue.ndjson}"

log() {
  printf '[push] %s\n' "$*"
}

require_value() {
  local flag="$1"
  if (($# < 2)); then
    echo "Missing value for ${flag}" >&2
    cat <<'USAGE' >&2
Usage: ./scripts/push-heliosapp-with-fallback.sh [options] [branch]
  --repo-root <path>
  --primary-remote <name>
  --fallback-remote <name>
  --origin-objects-tmp-dir <path>
  --queue-only
  --drain-queue
  --queue-file <path>
  --skip-primary
  --dry-run
  --help
USAGE
    exit 1
  fi
}

run_push() {
  local remote="$1"
  local ref="$2"
  if (( DRY_RUN == 1 )); then
    log "[DRY-RUN] git push ${remote} ${ref}"
    return 0
  fi
  GIT_TERMINAL_PROMPT=0 git push "$remote" "$ref"
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
  local context="$2"
  local normalized_remote="${remote_url#file://}"

  if ! is_local_path_remote "$remote_url"; then
    return 0
  fi

  if [[ ! -d "$normalized_remote" ]]; then
    log "${context}: path not found: $normalized_remote"
    return 1
  fi

  local objects_dir="${normalized_remote}/objects"
  local tmp_dir="${ORIGIN_OBJECTS_TMP_DIR:-$objects_dir/.tmp}"
  local legacy_tmp_dir="${objects_dir}/tmp"

  if [[ ! -d "$objects_dir" ]]; then
    log "${context}: objects path missing: $objects_dir"
    return 1
  fi

  if ! mkdir -p "$tmp_dir"; then
    log "${context}: cannot create temp directory: $tmp_dir"
    return 1
  fi

  if ! mkdir -p "$legacy_tmp_dir"; then
    log "${context}: cannot create legacy temp directory: $legacy_tmp_dir"
    return 1
  fi

  if [[ ! -w "$tmp_dir" || ! -w "$legacy_tmp_dir" ]]; then
    log "${context}: temp directory is not writable"
    return 1
  fi

  return 0
}

perform_push() {
  local branch="$1"
  local primary_remote="$2"
  local fallback_remote="$3"
  local skip_primary="$4"

  if (( SKIP_PRIMARY == 1 )); then
    skip_primary=1
  fi

  if (( skip_primary == 0 )); then
    log "Attempting push to $primary_remote"
    local primary_url=""
    if ! git remote get-url "$primary_remote" >/dev/null 2>&1; then
      log "Primary remote '$primary_remote' is not configured"
    else
      primary_url="$(git remote get-url "$primary_remote")"
      if ! ensure_local_remote_ready "$primary_url" "primary"; then
        log "Primary remote pre-check failed; trying fallback"
      else
        if run_push "$primary_remote" "$branch"; then
          log "Primary push succeeded"
          return 0
        fi
        log "Primary push failed. Trying fallback remote."
      fi
    fi
  fi

  local fallback_url=""
  fallback_url="$(git remote get-url "$fallback_remote")"
  if [[ -z "$fallback_url" ]]; then
    echo "Fallback remote '$fallback_remote' is not configured." >&2
    return 1
  fi

  if ! ensure_local_remote_ready "$fallback_url" "fallback"; then
    echo "Fallback remote pre-check failed: $fallback_url" >&2
    return 1
  fi

  log "Attempting push to $fallback_remote"
  if run_push "$fallback_remote" "$branch"; then
    log "Fallback push succeeded"
    return 0
  fi

  return 1
}

enqueue_push() {
  local branch="$1"
  local primary_remote="$2"
  local fallback_remote="$3"
  local skip_primary="$4"
  local dry_run="$5"
  local queue_file="${6:-}"

  local target_file="$QUEUE_FILE"
  if [[ -n "$queue_file" ]]; then
    target_file="$queue_file"
  fi

  mkdir -p "$(dirname "$target_file")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$branch" \
    "$primary_remote" \
    "$fallback_remote" \
    "$skip_primary" \
    "$dry_run" \
    "${ORIGIN_OBJECTS_TMP_DIR:-}" >> "$target_file"
  log "Queued push request -> $target_file"
}

drain_queue() {
  local queue_file="${1:-$QUEUE_FILE}"
  if [[ ! -f "$queue_file" ]]; then
    log "Queue file not found: $queue_file"
    return 0
  fi

  local tmp_file
  tmp_file="$(mktemp)"
  local status=0
  local entry_ts branch primary fallback skip_primary dry_run tmp_override

  while IFS=$'\t' read -r entry_ts branch primary fallback skip_primary dry_run tmp_override; do
    if [[ -z "${branch:-}" ]]; then
      continue
    fi

    local previous_tmp_dir="$ORIGIN_OBJECTS_TMP_DIR"
    if [[ -n "${tmp_override:-}" ]]; then
      ORIGIN_OBJECTS_TMP_DIR="$tmp_override"
    fi
    local previous_skip_primary="$SKIP_PRIMARY"
    local previous_dry_run="$DRY_RUN"
    DRY_RUN="$dry_run"
    SKIP_PRIMARY="$skip_primary"

    if (( DRY_RUN == 1 )); then
      log "[DRY-RUN] branch=${branch} primary=${primary} fallback=${fallback} skip-primary=${skip_primary}"
      status=1
    elif perform_push "$branch" "$primary" "$fallback" "$skip_primary"; then
      log "Queue item drained: $branch"
    else
      status=1
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$entry_ts" \
        "$branch" \
        "$primary" \
        "$fallback" \
        "$skip_primary" \
        "$dry_run" \
        "${tmp_override:-}" >> "$tmp_file"
    fi

    SKIP_PRIMARY="$previous_skip_primary"
    DRY_RUN="$previous_dry_run"
    ORIGIN_OBJECTS_TMP_DIR="$previous_tmp_dir"
  done < "$queue_file"

  if (( status == 0 )); then
    rm -f "$queue_file"
    log "Queue drained fully."
  else
    mv "$tmp_file" "$queue_file"
    return 1
  fi
  return 0
}

PRIMARY_REMOTE="${PHENOTYPE_PUSH_PRIMARY_REMOTE:-upstream}"
FALLBACK_REMOTE="${PHENOTYPE_PUSH_FALLBACK_REMOTE:-origin}"
DRY_RUN="${PHENOTYPE_PUSH_DRY_RUN:-0}"
SKIP_PRIMARY="${PHENOTYPE_PUSH_SKIP_PRIMARY:-0}"
ORIGIN_OBJECTS_TMP_DIR="${PHENOTYPE_PUSH_FALLBACK_TMP_DIR:-}"
BRANCH="${GIT_BRANCH:-}"
QUEUE_MODE=0
DRAIN_QUEUE=0

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
    --queue-only)
      QUEUE_MODE=1
      ;;
    --drain-queue)
      DRAIN_QUEUE=1
      ;;
    --queue-file)
      require_value "$1" "$#"
      shift
      QUEUE_FILE="$1"
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: ./scripts/push-heliosapp-with-fallback.sh [options] [branch]
  --repo-root <path>
  --primary-remote <name>
  --fallback-remote <name>
  --origin-objects-tmp-dir <path>
  --queue-only
  --drain-queue
  --queue-file <path>
  --skip-primary
  --dry-run
  --help
USAGE
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

if [[ -z "${PHENOTYPE_DEVOPS_REPO_ROOT:-}" ]]; then
  SHARED_HELPER_DIR="$REPO_ROOT/../agent-devops-setups"
else
  SHARED_HELPER_DIR="$PHENOTYPE_DEVOPS_REPO_ROOT"
fi
DEFAULT_PUSH_HELPER="$SHARED_HELPER_DIR/scripts/repo-push-fallback.sh"
SHARED_HELPER="${PHENOTYPE_DEVOPS_PUSH_HELPER:-$DEFAULT_PUSH_HELPER}"

if (( DRAIN_QUEUE == 0 && QUEUE_MODE == 0 )) && [[ -x "$SHARED_HELPER" ]]; then
  log "Using shared helper: $SHARED_HELPER"
  exec "$SHARED_HELPER" --repo-root "$REPO_ROOT" "$@"
fi

if ! cd "$REPO_ROOT"; then
  echo "Cannot enter repo root: $REPO_ROOT" >&2
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if (( DRAIN_QUEUE == 1 )); then
  if ! drain_queue "$QUEUE_FILE"; then
    echo "Queue drain completed with remaining items in $QUEUE_FILE" >&2
    exit 1
  fi
  exit 0
fi

if (( QUEUE_MODE == 1 )); then
  if [[ -z "$BRANCH" ]]; then
    echo "No branch resolved to queue" >&2
    exit 1
  fi
  enqueue_push "$BRANCH" "$PRIMARY_REMOTE" "$FALLBACK_REMOTE" "$SKIP_PRIMARY" "$DRY_RUN" "$QUEUE_FILE"
  exit 0
fi

log "Push branch: $BRANCH"
log "Primary remote: $PRIMARY_REMOTE"
log "Fallback remote: $FALLBACK_REMOTE"

git status --short --branch
log "Latest commits:"
git log --oneline -n 5

if (( SKIP_PRIMARY == 0 )) && (( DRY_RUN == 1 )); then
  log "[DRY-RUN] git push ${PRIMARY_REMOTE} ${BRANCH}"
fi

if ! perform_push "$BRANCH" "$PRIMARY_REMOTE" "$FALLBACK_REMOTE" "$SKIP_PRIMARY"; then
  echo "Push failed for branch '$BRANCH'." >&2
  exit 1
fi
