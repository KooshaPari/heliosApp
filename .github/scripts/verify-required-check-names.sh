#!/usr/bin/env bash
set -euo pipefail

MANIFEST=".github/required-checks.txt"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest: $MANIFEST" >&2
  exit 1
fi

missing=0
temp_manifest="$(mktemp)"
trap 'rm -f "$temp_manifest"' EXIT

awk 'NF > 0 && $1 !~ /^#/' "$MANIFEST" > "$temp_manifest"

if [[ ! -s "$temp_manifest" ]]; then
  echo "Required-check manifest has no entries: $MANIFEST" >&2
  exit 1
fi

pair_duplicates="$(sort "$temp_manifest" | uniq -d || true)"
if [[ -n "$pair_duplicates" ]]; then
  echo "Duplicate manifest entries found:" >&2
  printf '%s\n' "$pair_duplicates" >&2
  missing=1
fi

job_duplicates="$(awk -F'|' '{print $2}' "$temp_manifest" | sort | uniq -d || true)"
if [[ -n "$job_duplicates" ]]; then
  echo "Duplicate job_name values in manifest:" >&2
  printf '%s\n' "$job_duplicates" >&2
  missing=1
fi

while IFS='|' read -r workflow_file job_name; do
  if [[ -z "${job_name}" ]]; then
    echo "Invalid manifest entry (missing job name): ${workflow_file}|" >&2
    missing=1
    continue
  fi

  workflow_path=".github/workflows/${workflow_file}"
  if [[ ! -f "${workflow_path}" ]]; then
    echo "Missing workflow file: ${workflow_path}" >&2
    missing=1
    continue
  fi

  escaped_job_name="$(printf '%s' "${job_name}" | sed 's/[][(){}.^$*+?|\\/]/\\&/g')"
  if ! grep -Eq "^[[:space:]]+name:[[:space:]]*[\"']?${escaped_job_name}[\"']?[[:space:]]*$" "${workflow_path}"; then
    echo "Missing required check name '${job_name}' in ${workflow_path}" >&2
    missing=1
  fi
done < "$temp_manifest"

if (( missing != 0 )); then
  echo "Required check name verification failed." >&2
  exit 1
fi

echo "Required check name verification passed."
