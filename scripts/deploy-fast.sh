#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="${REPO_ROOT}/scripts/smoke-rust-api.sh"

say() {
  printf '[fast] %s\n' "$*"
}

require_smoke() {
  if [[ ! -x "${SMOKE_SCRIPT}" ]]; then
    echo "[fast] missing smoke script: ${SMOKE_SCRIPT}" >&2
    exit 1
  fi
}

deploy_api_vm() {
  say "api-vm: syncing changed rust-api files"
  rsync -az \
    --delete \
    --exclude target \
    --exclude build \
    "${REPO_ROOT}/rust-api/" \
    api-vm:/srv/cssos/repo/rust-api/
  scp "${SMOKE_SCRIPT}" api-vm:/tmp/smoke-rust-api.sh >/dev/null

  say "api-vm: build, restart, smoke"
  ssh api-vm '
    set -euo pipefail
    export PATH=/home/jing/.cargo/bin:$PATH
    cd /srv/cssos/repo/rust-api
    cargo build --release
    sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
    sudo install -m 755 /tmp/smoke-rust-api.sh /usr/local/bin/cssos-rust-smoke
    sudo systemctl restart cssos-rust-api
    sleep 2
    sudo systemctl is-active --quiet cssos-rust-api
    /usr/local/bin/cssos-rust-smoke
  '
}

deploy_gzvm() {
  say "gzvm: syncing changed rust-api files"
  rsync -az \
    --delete \
    --exclude target \
    --exclude build \
    -e "ssh -o RemoteCommand=none -T" \
    "${REPO_ROOT}/rust-api/" \
    gzvm:/home/ubuntu/cssOS/rust-api/
  scp -o RemoteCommand=none -T "${SMOKE_SCRIPT}" gzvm:/tmp/smoke-rust-api.sh >/dev/null

  say "gzvm: build, restart, smoke"
  ssh -o RemoteCommand=none -T gzvm '
    set -euo pipefail
    export PATH=/home/ubuntu/.cargo/bin:$PATH
    cd /home/ubuntu/cssOS/rust-api
    cargo build --release
    sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
    sudo install -m 755 /tmp/smoke-rust-api.sh /usr/local/bin/cssos-rust-smoke
    sudo systemctl restart cssos-rust-api
    sleep 2
    sudo systemctl is-active --quiet cssos-rust-api
    /usr/local/bin/cssos-rust-smoke
  '
}

require_smoke

case "${TARGET}" in
  api-vm)
    deploy_api_vm
    ;;
  gzvm)
    deploy_gzvm
    ;;
  *)
    echo "usage: TARGET={api-vm|gzvm} $(basename "$0")" >&2
    exit 1
    ;;
esac

say "done"
