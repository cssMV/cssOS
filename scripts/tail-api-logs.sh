#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-all}"
LINES="${LINES:-120}"
FOLLOW="${FOLLOW:-0}"

say() {
  printf '[logs] %s\n' "$*"
}

run_api_vm() {
  say "api-vm: cssos-rust-api last ${LINES} lines"
  if [[ "${FOLLOW}" == "1" ]]; then
    ssh api-vm "sudo journalctl -u cssos-rust-api -n ${LINES} -f --no-pager"
  else
    ssh api-vm "sudo journalctl -u cssos-rust-api -n ${LINES} --no-pager"
  fi
}

case "${TARGET}" in
  api-vm|all)
    run_api_vm
    ;;
  *)
    echo "usage: TARGET={api-vm|all} LINES=120 FOLLOW=0 $(basename "$0")" >&2
    exit 1
    ;;
esac
