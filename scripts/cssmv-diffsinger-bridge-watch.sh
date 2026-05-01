#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "usage: cssmv-diffsinger-bridge-watch.sh <bridge_output_dir> [interval_sec]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/cssmv-diffsinger-bridge-watch.py" "$@"
