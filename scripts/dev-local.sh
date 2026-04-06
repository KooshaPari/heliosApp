#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJ_DIR"

find_free_port() {
  python3 - "$@" <<'PY'
import random
import socket
import sys

preferred = int(sys.argv[1]) if len(sys.argv) > 1 else None

def is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) != 0

if preferred and is_free(preferred):
    print(preferred)
    raise SystemExit(0)

for _ in range(200):
    port = random.randint(20000, 45000)
    if is_free(port):
        print(port)
        raise SystemExit(0)

raise SystemExit("no free port found")
PY
}

export VITE_PORT="${VITE_PORT:-$(find_free_port 3001)}"
export VITE_PREVIEW_PORT="${VITE_PREVIEW_PORT:-$(find_free_port 4173)}"

mkdir -p .process-compose .process-compose/logs

cat <<EOF
=== heliosApp local remote ===
  app:     http://localhost:${VITE_PORT}
  preview: http://localhost:${VITE_PREVIEW_PORT}
EOF

exec process-compose up -f process-compose.yaml
