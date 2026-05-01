#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-api-vm}"

say() {
  printf '[media-sync-install] %s\n' "$*"
}

install_target() {
  local target="$1"
  say "${target}: syncing cssos-media-sync script"
  cat /Users/jing/cssOS/scripts/ops/cssos-media-sync.sh | ssh "$target" "sudo mkdir -p /home/jing/cssOS/repo/scripts/ops && sudo tee /home/jing/cssOS/repo/scripts/ops/cssos-media-sync.sh >/dev/null && sudo chmod +x /home/jing/cssOS/repo/scripts/ops/cssos-media-sync.sh"
  say "${target}: reloading unit state"
  ssh "$target" "sudo systemctl reset-failed cssos-media-sync.service cssos-media-sync.path || true; sudo systemctl daemon-reload; sudo systemctl enable --now cssos-media-sync.path; sudo systemctl start cssos-media-sync.service; systemctl status cssos-media-sync.service --no-pager --lines=5"
}

case "${TARGET}" in
  api-vm)
    install_target api-vm
    ;;
  *)
    echo "usage: TARGET=api-vm $(basename "$0")" >&2
    exit 1
    ;;
esac
