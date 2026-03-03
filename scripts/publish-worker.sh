#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUSH_SCRIPT="$REPO_ROOT/scripts/push-heliosapp-with-fallback.sh"
QUEUE_FILE="${PHENOTYPE_PUSH_QUEUE_FILE:-$REPO_ROOT/.git/push-queue.ndjson}"
LOCK_DIR="${PHENOTYPE_PUBLISH_WORKER_LOCK_DIR:-$REPO_ROOT/.git/publish-worker.lock}"
POLL_SECONDS="${PHENOTYPE_PUBLISH_WORKER_POLL_SECONDS:-30}"
RUN_ONCE=0
DRY_RUN=0
JSON_OUTPUT=0

log() {
  printf '[publish-worker] %s\n' "$*"
}

usage() {
  cat <<'USAGE'
Usage: ./scripts/publish-worker.sh [options]
  --once                 Run one queue-drain iteration and exit
  --queue-file <path>    Queue file path override
  --poll-seconds <int>   Loop sleep duration (default: 30)
  --dry-run              Drain queue in dry-run mode
  --json                 Forward JSON output from drain command
  --help
USAGE
}

while (($#)); do
  case "$1" in
    --once)
      RUN_ONCE=1
      ;;
    --queue-file)
      shift
      QUEUE_FILE="$1"
      ;;
    --poll-seconds)
      shift
      POLL_SECONDS="$1"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --json)
      JSON_OUTPUT=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "${PHENOTYPE_PUBLISH_WORKER_NON_SANDBOX:-0}" != "1" ]]; then
  echo "Refusing to run publish worker without PHENOTYPE_PUBLISH_WORKER_NON_SANDBOX=1" >&2
  exit 1
fi

if [[ ! -x "$PUSH_SCRIPT" ]]; then
  echo "Push script not found or not executable: $PUSH_SCRIPT" >&2
  exit 1
fi

mkdir -p "$(dirname "$QUEUE_FILE")"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Publish worker lock is held: $LOCK_DIR" >&2
  exit 1
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

drain_once() {
  local args=(--drain-queue --queue-file "$QUEUE_FILE")
  if (( DRY_RUN == 1 )); then
    args+=(--dry-run)
  fi
  if (( JSON_OUTPUT == 1 )); then
    args+=(--json)
  fi

  "$PUSH_SCRIPT" "${args[@]}"
}

if (( RUN_ONCE == 1 )); then
  log "Running one publish-worker cycle"
  drain_once
  exit 0
fi

log "Starting publish-worker loop (poll=${POLL_SECONDS}s, queue=$QUEUE_FILE)"
while true; do
  if ! drain_once; then
    log "Queue drain returned non-zero; retaining queue for next cycle"
  fi
  sleep "$POLL_SECONDS"
done
