#!/usr/bin/env bash
# Wrapper: delegate to Python for reliable cross-platform path handling.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/generate-doc-index.py" "$@"
