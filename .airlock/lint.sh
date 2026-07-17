#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Compute changed files between base and head
BASE="${AIRLOCK_BASE_SHA:-HEAD~1}"
HEAD="${AIRLOCK_HEAD_SHA:-HEAD}"

ALL_CHANGED=()
while IFS= read -r line; do
  [ -n "$line" ] && ALL_CHANGED+=("$line")
done < <(git diff --name-only --diff-filter=ACMR "$BASE" "$HEAD" 2>/dev/null || true)

if [ ${#ALL_CHANGED[@]} -eq 0 ]; then
  echo "No changed files found."
  exit 0
fi

# Filter to biome-relevant file types
RELEVANT=()
for f in "${ALL_CHANGED[@]}"; do
  if [[ -f "$f" ]] && [[ "$f" =~ \.(ts|tsx|js|jsx|json|jsonc|vue)$ ]]; then
    RELEVANT+=("$f")
  fi
done

if [ ${#RELEVANT[@]} -eq 0 ]; then
  echo "No lint-relevant files changed."
  exit 0
fi

echo "Linting ${#RELEVANT[@]} changed file(s)..."

# Step 1: Auto-fix (format + lint)
echo "==> Running biome check --write (auto-fix)..."
bunx biome check --write --unsafe "${RELEVANT[@]}" || true

# Step 2: Verify — check mode (no writes)
echo "==> Running biome check (verify)..."
bunx biome check "${RELEVANT[@]}"

echo "All checks passed."
