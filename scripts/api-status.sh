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

run_gzvm() {
  echo "[status] gzvm"
  ssh -o RemoteCommand=none -T gzvm '
    set -euo pipefail
    echo "--- systemd ---"
    systemctl status cssos-rust-api --no-pager -n 8 | sed -n "1,18p"
    echo "--- listen ---"
    ss -ltnp | grep cssos-rust-api || true
    echo "--- smoke local ---"
    /usr/local/bin/cssos-rust-smoke
    echo "--- smoke host-routed ---"
    SKIP_HEALTH=1 RESOLVE_HOST=zh.cssstudio.app:443:127.0.0.1 BASE_URL=https://zh.cssstudio.app CURL_OPTS="-kfsS" /usr/local/bin/cssos-rust-smoke
  '
}

case "${TARGET}" in
  api-vm)
    run_api_vm
    ;;
  gzvm)
    run_gzvm
    ;;
  all)
    run_api_vm
    printf '\n'
    run_gzvm
    ;;
  *)
    echo "usage: TARGET={api-vm|gzvm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac
