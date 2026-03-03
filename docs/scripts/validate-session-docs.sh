#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs"
SESSIONS_DIR="$DOCS_DIR/sessions"

REQUIRED_SESSION_FILES=(
  "00_SESSION_OVERVIEW.md"
  "01_RESEARCH.md"
  "02_SPECIFICATIONS.md"
  "03_DAG_WBS.md"
  "04_IMPLEMENTATION_STRATEGY.md"
  "05_KNOWN_ISSUES.md"
  "06_TESTING_STRATEGY.md"
)

LINK_EXCLUDE_PATTERNS=(
  '^#'
  '^http[s]?://'
  '^mailto:'
  '^javascript:'
  '^\?'
  '^\$'
  '^data:'
)

failures=0

warn_missing() {
  local msg="$1"
  echo "[WARN] $msg"
}

fail_missing() {
  local msg="$1"
  failures=$((failures + 1))
  echo "[FAIL] $msg"
}

is_ignored_link_target() {
  local target="$1"
  local pattern

  for pattern in "${LINK_EXCLUDE_PATTERNS[@]}"; do
    if [[ "$target" =~ $pattern ]]; then
      return 0
    fi
  done

  return 1
}

validate_session_files() {
  local session_dir
  for session_dir in "$SESSIONS_DIR"/*; do
    [ -d "$session_dir" ] || continue

    local base_name
    base_name="$(basename "$session_dir")"
    if [ "$base_name" = "default" ] || [[ "$base_name" == .* ]]; then
      continue
    fi

    local required_file
    for required_file in "${REQUIRED_SESSION_FILES[@]}"; do
      if [ ! -f "$session_dir/$required_file" ]; then
        fail_missing "Missing required session doc: $session_dir/$required_file"
      fi
    done

    local dag_file="$session_dir/03_DAG_WBS.md"
    if [[ "$base_name" == 2026* ]]; then
      if [ ! -f "$dag_file" ]; then
        fail_missing "Missing required WBS file in $session_dir: $dag_file"
      elif ! tr '[:upper:]' '[:lower:]' < "$dag_file" | rg -q '^[[:space:]]*-[[:space:]]*\[status:done\].*handoff[_ -]?readiness.*(ready|yes|true|done|approved)'; then
        fail_missing "Missing handoff-readiness marker in $dag_file"
      fi
    fi
  done
}

extract_markdown_links() {
  local file="$1"
  perl -ne '
    # Inline markdown links and image targets: [text](target) or ![alt](target)
    while (/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g) {
      print "$ARGV\t$line_num\t$1\n";
    }
    # Reference-style link definitions: [id]: target
    while (/^\s*\[[^\]]+\]:\s*([^\s]+)\s*$/g) {
      print "$ARGV\t$line_num\t$1\n";
    }
    BEGIN { $line_num = 1; }
    END { }
    $line_num++;
  ' "$file"
}

clean_link_target() {
  local target="$1"
  local cleaned

  cleaned="${target%%#*}"
  cleaned="${cleaned%%\?*}"
  cleaned="${cleaned%\"}"
  cleaned="${cleaned#\"}"
  cleaned="${cleaned%\'}"
  cleaned="${cleaned#\'}"
  cleaned="${cleaned%>}"
  cleaned="${cleaned#<}"

  echo "$cleaned"
}

link_target_exists() {
  local base_dir="$1"
  local target="$2"
  local candidate=""
  local md_variant=""
  local index_variant=""
  local readme_variant=""

  if [[ "$target" == ../docs/* ]]; then
    candidate="$ROOT_DIR/${target#../}"
  elif [[ "$target" == ../* ]]; then
    candidate="$ROOT_DIR/${target#../}"
  elif [[ "$target" == ./* ]]; then
    candidate="$base_dir/${target#./}"
  elif [[ "$target" == /* ]]; then
    candidate="$DOCS_DIR$target"
  else
    candidate="$base_dir/$target"
  fi

  candidate="${candidate%/}"

  if [[ -f "$candidate" ]]; then
    return 0
  fi

  md_variant="$candidate.md"
  index_variant="$candidate/index.md"
  readme_variant="$candidate/README.md"

  if [ -d "$candidate" ]; then
    if [ -f "$readme_variant" ] || [ -f "$index_variant" ]; then
      return 0
    fi
  fi

  if [ -f "$md_variant" ] || [ -f "$index_variant" ] || [ -f "$readme_variant" ]; then
    return 0
  fi

  return 1
}

validate_markdown_link_targets() {
  local file
  while IFS= read -r -d '' file; do
    while IFS=$'\t' read -r _ file_line raw_target; do
      [ -n "$raw_target" ] || continue

      local target
      target="$(clean_link_target "$raw_target")"
      [ -n "$target" ] || continue
      is_ignored_link_target "$target" && continue

      if ! link_target_exists "$(dirname "$file")" "$target"; then
        fail_missing "Broken local link in ${file}:${file_line}: ${raw_target}"
      fi
    done < <(extract_markdown_links "$file")
  done < <(find "$DOCS_DIR" \
    -path "$DOCS_DIR/.generated" -prune -o \
    -path "$DOCS_DIR/.archive" -prune -o \
    -name "*.md" -type f -print0)
}

echo "[INFO] Validating required session docs in $SESSIONS_DIR"
validate_session_files

echo "[INFO] Validating markdown local links in $DOCS_DIR/**/*.md"
validate_markdown_link_targets

if [ "$failures" -ne 0 ]; then
  echo "[INFO] Session and docs validation failed with $failures issues"
  exit 1
fi

echo "[INFO] Session and docs validation passed"
