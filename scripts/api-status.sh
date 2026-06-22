#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-all}"

run_api_vm() {
  echo "[status] api-vm"
  ssh api-vm '
    set -euo pipefail
    echo "--- systemd ---"
    systemctl status cssos-rust-api --no-pager -n 8 | sed -n "1,18p"
    echo "--- listen ---"
    ss -ltnp | grep cssos-rust-api || true
    echo "--- smoke local ---"
    /usr/local/bin/cssos-rust-smoke
    echo "--- smoke public ---"
    BASE_URL=https://cssstudio.app /usr/local/bin/cssos-rust-smoke
  '
}

case "${TARGET}" in
  api-vm|all)
    run_api_vm
    ;;
  *)
    echo "usage: TARGET={api-vm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac
