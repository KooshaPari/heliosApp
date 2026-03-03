#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_HELPER_DIR="${PHENOTYPE_DEVOPS_REPO_ROOT:-}"
QUEUE_FILE="${PHENOTYPE_PUSH_QUEUE_FILE:-$REPO_ROOT/.git/push-queue.ndjson}"
MAX_PUSH_RETRIES="${PHENOTYPE_PUSH_MAX_RETRIES:-3}"
RETRY_DELAY_SECONDS="${PHENOTYPE_PUSH_RETRY_DELAY_SECONDS:-2}"
JSON_OUTPUT="${PHENOTYPE_PUSH_JSON_OUTPUT:-0}"
JSON_SUMMARY_FILE="${PHENOTYPE_PUSH_JSON_SUMMARY_FILE:-}"
LAST_PUSH_REASON=""
DNS_RETRY_COUNT=0
OBJECT_TMP_DIR_RETRY_COUNT=0
PRIMARY_ATTEMPTS=0
FALLBACK_ATTEMPTS=0
PRIMARY_ATTEMPTED=0
FALLBACK_ATTEMPTED=0
PRIMARY_REASON=""
FALLBACK_REASON=""
PRIMARY_SUCCESS=0
FALLBACK_SUCCESS=0
DRY_RUN_SUMMARY=""

log() {
  printf '[push] %s\n' "$*"
}

log_hint() {
  printf '[push][hint] %s\n' "$*"
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
  --json
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

run_push_capture() {
  local remote="$1"
  local ref="$2"

  if (( DRY_RUN == 1 )); then
    echo "[DRY-RUN] git push ${remote} ${ref}"
    return 0
  fi

  set +e
  local output
  output="$(GIT_TERMINAL_PROMPT=0 git push "$remote" "$ref" 2>&1)"
  local status=$?
  set -e

  if (( status != 0 )); then
    echo "$output"
    return "$status"
  fi

  return 0
}

classify_push_error() {
  local output="$1"

  if [[ "$output" == *"Could not resolve host"* ]] ||
    [[ "$output" == *"Could not resolve proxy"* ]] ||
    [[ "$output" == *"Temporary failure in name resolution"* ]] ||
    [[ "$output" == *"Operation timed out"* ]] ||
    [[ "$output" == *"Failed to connect to"* ]] ||
    [[ "$output" == *"Network is unreachable"* ]]; then
    echo "dns_network"
    return 0
  fi

  if [[ "$output" == *"unable to create temporary object directory"* ]] ||
    [[ "$output" == *"remote: unpack failed: unable to create temporary object directory"* ]] ||
    [[ "$output" == *"temp object directory"* ]]; then
    echo "object_tmp_dir"
    return 0
  fi

  if [[ "$output" == *"Updates were rejected"* ]] ||
    [[ "$output" == *"fetch first"* ]] ||
    [[ "$output" == *"failed to push some refs"* ]] ||
    [[ "$output" == *"non-fast-forward"* ]] ||
    [[ "$output" == *"error: failed to push some refs"* ]]; then
    echo "non_fast_forward"
    return 0
  fi

  if [[ "$output" == *"Please make sure you have the correct access rights"* ]] ||
    [[ "$output" == *"Permission denied"* ]] ||
    [[ "$output" == *"Authentication failed"* ]] ||
    [[ "$output" == *"Could not read from remote repository"* ]] ||
    [[ "$output" == *"repository not found"* ]]; then
    echo "auth_or_acl"
    return 0
  fi

  echo "unknown"
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

is_retryable_failure() {
  local reason="$1"
  [[ "$reason" == "dns_network" || "$reason" == "object_tmp_dir" ]]
}

track_retry_reason() {
  local reason="$1"

  case "$reason" in
    dns_network)
      DNS_RETRY_COUNT=$((DNS_RETRY_COUNT + 1))
      ;;
    object_tmp_dir)
      OBJECT_TMP_DIR_RETRY_COUNT=$((OBJECT_TMP_DIR_RETRY_COUNT + 1))
      ;;
  esac
}

emit_object_tmp_hint() {
  local remote_path="$1"
  local objects_dir="$2"
  log_hint "Local mirror writable check failed for $remote_path."
  log_hint "Suggested remediation (one-shot): run"
  log_hint "  mkdir -p \"$objects_dir/.tmp\" \"$objects_dir/tmp\" && chmod -R 775 \"$objects_dir\""
}

ensure_local_remote_ready() {
  local remote_url="$1"
  local context="$2"
  local normalized_remote="${remote_url#file://}"
  local objects_dir="${normalized_remote}/objects"

  if ! is_local_path_remote "$remote_url"; then
    return 0
  fi

  if [[ ! -d "$normalized_remote" ]]; then
    log "${context}: path not found: $normalized_remote"
    return 1
  fi

  local tmp_dir="${ORIGIN_OBJECTS_TMP_DIR:-$objects_dir/.tmp}"
  local legacy_tmp_dir="${objects_dir}/tmp"

  if [[ ! -d "$objects_dir" ]]; then
    log "${context}: objects path missing: $objects_dir"
    return 1
  fi

  if ! mkdir -p "$tmp_dir"; then
    log "${context}: cannot create temp directory: $tmp_dir"
    emit_object_tmp_hint "$normalized_remote" "$objects_dir"
    return 1
  fi

  if ! mkdir -p "$legacy_tmp_dir"; then
    log "${context}: cannot create legacy temp directory: $legacy_tmp_dir"
    emit_object_tmp_hint "$normalized_remote" "$objects_dir"
    return 1
  fi

  if [[ ! -w "$tmp_dir" || ! -w "$legacy_tmp_dir" ]]; then
    log "${context}: temp directory is not writable"
    emit_object_tmp_hint "$normalized_remote" "$objects_dir"
    return 1
  fi

  return 0
}

run_push_attempt() {
  local remote="$1"
  local ref="$2"
  local attempt="$3"
  local max_attempts="$4"
  local attempt_output
  local remote_url=""
  remote_url="$(git remote get-url "$remote" 2>/dev/null || true)"

  log "Attempting push to ${remote} (attempt ${attempt}/${max_attempts})"
  if attempt_output="$(run_push_capture "$remote" "$ref")"; then
    log "${remote} push succeeded"
    return 0
  fi

  log "${remote} push failed:"
  printf '%s\n' "$attempt_output"
  local reason
  reason="$(classify_push_error "$attempt_output")"
  LAST_PUSH_REASON="$reason"
  track_retry_reason "$reason"
  log "Push failure classification: ${reason}"

  case "$reason" in
    dns_network)
      log_hint "DNS/network appears blocked or unstable; waiting for retry."
      ;;
    object_tmp_dir)
      if [[ -n "$remote_url" ]]; then
        emit_object_tmp_hint "$remote" "${remote_url#file://}/objects"
      else
        emit_object_tmp_hint "$remote" "$remote"
      fi
      ;;
    non_fast_forward)
      log_hint "Non-fast-forward path detected; pull/rebase remote changes before retrying."
      ;;
    auth_or_acl)
      log_hint "Authentication or access control issue; verify remote permissions and token scope."
      ;;
    *)
      log_hint "Unknown push blocker; inspect command output and remediation context above."
      ;;
  esac

  if ! is_retryable_failure "$reason"; then
    return 1
  fi

  if (( attempt >= max_attempts )); then
    log_hint "Retry budget exhausted for ${remote}."
    return 1
  fi

  local delay=$(( RETRY_DELAY_SECONDS * attempt ))
  log "Waiting ${delay}s before retry..."
  sleep "$delay"
  return 1
}

run_push_with_retries() {
  local remote="$1"
  local ref="$2"
  local attempt=1
  local attempts=0
  local final_reason=""

  while (( attempt <= MAX_PUSH_RETRIES )); do
    if run_push_attempt "$remote" "$ref" "$attempt" "$MAX_PUSH_RETRIES"; then
      attempts=$((attempts + 1))
      if [[ "$remote" == "$PRIMARY_REMOTE" ]]; then
        PRIMARY_SUCCESS=1
        PRIMARY_ATTEMPTS="$attempts"
        PRIMARY_REASON=""
      else
        FALLBACK_SUCCESS=1
        FALLBACK_ATTEMPTS="$attempts"
        FALLBACK_REASON=""
      fi
      return 0
    fi

    final_reason="$LAST_PUSH_REASON"
    attempts=$((attempts + 1))
    (( attempt++ ))
  done

  if [[ "$remote" == "$PRIMARY_REMOTE" ]]; then
    PRIMARY_ATTEMPTS="$attempts"
    PRIMARY_REASON="$final_reason"
  else
    FALLBACK_ATTEMPTS="$attempts"
    FALLBACK_REASON="$final_reason"
  fi

  return 1
}

run_shared_helper() {
  local helper_status=0
  local helper_output_file
  helper_output_file="$(mktemp)"

  if "$SHARED_HELPER" "${HELPER_ARGS[@]}" > "$helper_output_file" 2>&1; then
    cat "$helper_output_file"
    rm -f "$helper_output_file"
    return 0
  fi
  helper_status=$?
  cat "$helper_output_file"
  rm -f "$helper_output_file"
  return "$helper_status"
}

emit_push_summary_json() {
  local final_status="$1"
  local final_reason="$2"
  local payload
  payload="$(FINAL_STATUS="$final_status" FINAL_REASON="$final_reason" REPO_ROOT="$REPO_ROOT" BRANCH="$BRANCH" PRIMARY_REMOTE="$PRIMARY_REMOTE" FALLBACK_REMOTE="$FALLBACK_REMOTE" PRIMARY_ATTEMPTED="$PRIMARY_ATTEMPTED" FALLBACK_ATTEMPTED="$FALLBACK_ATTEMPTED" PRIMARY_SUCCESS="$PRIMARY_SUCCESS" FALLBACK_SUCCESS="$FALLBACK_SUCCESS" PRIMARY_ATTEMPTS="$PRIMARY_ATTEMPTS" FALLBACK_ATTEMPTS="$FALLBACK_ATTEMPTS" PRIMARY_REASON="$PRIMARY_REASON" FALLBACK_REASON="$FALLBACK_REASON" DNS_RETRY_COUNT="$DNS_RETRY_COUNT" OBJECT_TMP_DIR_RETRY_COUNT="$OBJECT_TMP_DIR_RETRY_COUNT" DRY_RUN="$DRY_RUN" SKIP_PRIMARY="$SKIP_PRIMARY" QUEUE_MODE="$QUEUE_MODE" DRAIN_QUEUE="$DRAIN_QUEUE" ORIGIN_OBJECTS_TMP_DIR="$ORIGIN_OBJECTS_TMP_DIR" python - <<'PY'
import json
import os

payload = {
  "status": os.environ.get("FINAL_STATUS", "failed"),
  "repository_root": os.environ.get("REPO_ROOT", ""),
  "branch": os.environ.get("BRANCH", ""),
  "remotes": {
    "primary": {
      "name": os.environ.get("PRIMARY_REMOTE", ""),
      "attempted": os.environ.get("PRIMARY_ATTEMPTED", "0") == "1",
      "success": os.environ.get("PRIMARY_SUCCESS", "0") == "1",
      "attempt_count": int(os.environ.get("PRIMARY_ATTEMPTS", "0")),
      "reason": os.environ.get("PRIMARY_REASON", ""),
    },
    "fallback": {
      "name": os.environ.get("FALLBACK_REMOTE", ""),
      "attempted": os.environ.get("FALLBACK_ATTEMPTED", "0") == "1",
      "success": os.environ.get("FALLBACK_SUCCESS", "0") == "1",
      "attempt_count": int(os.environ.get("FALLBACK_ATTEMPTS", "0")),
      "reason": os.environ.get("FALLBACK_REASON", ""),
    },
  },
  "retry_counters": {
    "dns_network": int(os.environ.get("DNS_RETRY_COUNT", "0")),
    "object_tmp_dir": int(os.environ.get("OBJECT_TMP_DIR_RETRY_COUNT", "0")),
  },
  "dry_run": os.environ.get("DRY_RUN", "0") == "1",
  "skip_primary": os.environ.get("SKIP_PRIMARY", "0") == "1",
  "mode": {
    "queue_mode": os.environ.get("QUEUE_MODE", "0") == "1",
    "drain_queue": os.environ.get("DRAIN_QUEUE", "0") == "1",
  },
  "fallback_tmp_dir_override": os.environ.get("ORIGIN_OBJECTS_TMP_DIR", ""),
  "final_reason": os.environ.get("FINAL_REASON", ""),
}
print(json.dumps(payload, sort_keys=True))
PY
  )"

  if [[ -n "${JSON_SUMMARY_FILE}" ]]; then
    printf '%s\n' "$payload" > "$JSON_SUMMARY_FILE"
  fi

  printf '%s\n' "$payload"
}

perform_push() {
  local branch="$1"
  local primary_remote="$2"
  local fallback_remote="$3"
  local skip_primary="$4"
  PRIMARY_ATTEMPTED=0
  FALLBACK_ATTEMPTED=0
  PRIMARY_REASON=""
  FALLBACK_REASON=""
  PRIMARY_SUCCESS=0
  FALLBACK_SUCCESS=0
  PRIMARY_ATTEMPTS=0
  FALLBACK_ATTEMPTS=0

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
        PRIMARY_ATTEMPTED=1
        if run_push_with_retries "$primary_remote" "$branch"; then
          log "Primary push succeeded"
          return 0
        fi
        log "Primary push failed. Trying fallback remote."
      fi
    fi
  fi

  local fallback_url=""
  if ! fallback_url="$(git remote get-url "$fallback_remote" 2>/dev/null)"; then
    echo "Fallback remote '$fallback_remote' is not configured." >&2
    return 1
  fi

  if ! ensure_local_remote_ready "$fallback_url" "fallback"; then
    echo "Fallback remote pre-check failed: $fallback_url" >&2
    return 1
  fi

  FALLBACK_ATTEMPTED=1
  log "Attempting push to $fallback_remote"
  if run_push_with_retries "$fallback_remote" "$branch"; then
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

  if (( DRY_RUN == 1 )); then
    local queue_items=0
    while IFS=$'\t' read -r entry_ts branch primary fallback skip_primary dry_run tmp_override; do
      if [[ -z "${branch:-}" ]]; then
        continue
      fi
      queue_items=$((queue_items + 1))
      log "[DRY-RUN] branch=${branch} primary=${primary} fallback=${fallback} skip-primary=${skip_primary} tmp-dir-override=${tmp_override:-<none>}"
    done < "$queue_file"

    log "[DRY-RUN] queue preview complete: ${queue_items} item(s) in $queue_file"
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
    --json)
      JSON_OUTPUT=1
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
  --json
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

if (( JSON_OUTPUT == 0 )) && (( DRAIN_QUEUE == 0 && QUEUE_MODE == 0 )) && [[ -x "$SHARED_HELPER" ]]; then
  HELPER_ARGS=(
    --repo-root
    "$REPO_ROOT"
  )

  if [[ "$PRIMARY_REMOTE" != "upstream" ]]; then
    HELPER_ARGS+=(--primary-remote "$PRIMARY_REMOTE")
  fi

  if [[ "$FALLBACK_REMOTE" != "origin" ]]; then
    HELPER_ARGS+=(--fallback-remote "$FALLBACK_REMOTE")
  fi

  if [[ -n "$ORIGIN_OBJECTS_TMP_DIR" ]]; then
    HELPER_ARGS+=(--origin-objects-tmp-dir "$ORIGIN_OBJECTS_TMP_DIR")
  fi

  if (( SKIP_PRIMARY == 1 )); then
    HELPER_ARGS+=(--skip-primary)
  fi

  if (( DRY_RUN == 1 )); then
    HELPER_ARGS+=(--dry-run)
  fi

  if [[ -n "$BRANCH" ]]; then
    HELPER_ARGS+=("$BRANCH")
  fi

  log "Using shared helper: $SHARED_HELPER"
  log "Shared helper args: ${HELPER_ARGS[*]}"
  if [[ "${PHENOTYPE_PUSH_DISABLE_SHARED_HELPER:-0}" == "1" ]]; then
    log "Shared helper execution disabled by PHENOTYPE_PUSH_DISABLE_SHARED_HELPER=1"
  elif run_shared_helper; then
    exit 0
  else
    log "Shared helper failed; switching to local fallback implementation."
    log "Local fallback includes deterministic retry policy and failure classification."
  fi
fi

if ! cd "$REPO_ROOT"; then
  echo "Cannot enter repo root: $REPO_ROOT" >&2
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if (( DRAIN_QUEUE == 1 )); then
  if drain_queue "$QUEUE_FILE"; then
    if (( JSON_OUTPUT == 1 )); then
      emit_push_summary_json "success" ""
    fi
    if (( DRY_RUN == 1 )); then
      log "Queue drain dry-run completed successfully."
    fi
    exit 0
  fi
  if (( JSON_OUTPUT == 1 )); then
    emit_push_summary_json "failed" "drain-errors"
  fi
  echo "Queue drain completed with remaining items in $QUEUE_FILE" >&2
  exit 1
fi

if (( QUEUE_MODE == 1 )); then
  if [[ -z "$BRANCH" ]]; then
    echo "No branch resolved to queue" >&2
    exit 1
  fi
  enqueue_push "$BRANCH" "$PRIMARY_REMOTE" "$FALLBACK_REMOTE" "$SKIP_PRIMARY" "$DRY_RUN" "$QUEUE_FILE"
  if [[ "$JSON_OUTPUT" == "1" ]]; then
    emit_push_summary_json "queued" ""
  fi
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
  if [[ "$JSON_OUTPUT" == "1" ]]; then
    emit_push_summary_json "failed" "$LAST_PUSH_REASON"
  fi
  echo "Push failed for branch '$BRANCH'." >&2
  exit 1
fi

if [[ "$JSON_OUTPUT" == "1" ]]; then
  emit_push_summary_json "success" ""
fi

exit 0
