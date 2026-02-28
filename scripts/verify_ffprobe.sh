#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe not found"
  exit 1
fi

ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1" | head -n 1
