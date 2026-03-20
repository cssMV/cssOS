#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-all}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="${REPO_ROOT}/scripts/smoke-rust-api.sh"

if [[ ! -x "${SMOKE_SCRIPT}" ]]; then
  echo "[deploy] missing smoke script: ${SMOKE_SCRIPT}" >&2
  exit 1
fi

say() {
  printf '[deploy] %s\n' "$*"
}

deploy_api_vm() {
  say "api-vm: syncing rust-api and scripts"
  rsync -az --delete \
    --exclude target \
    --exclude build \
    "${REPO_ROOT}/rust-api/" \
    api-vm:/srv/cssos/repo/rust-api/
  rsync -az \
    "${REPO_ROOT}/scripts/" \
    api-vm:/srv/cssos/repo/scripts/
  scp "${SMOKE_SCRIPT}" api-vm:/tmp/smoke-rust-api.sh >/dev/null

  say "api-vm: building and restarting cssos-rust-api"
  ssh api-vm '
    set -euo pipefail
    export PATH=/home/jing/.cargo/bin:$PATH
    cd /srv/cssos/repo/rust-api
    cargo build --release
    sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
    sudo install -m 755 /tmp/smoke-rust-api.sh /srv/cssos/bin/smoke-rust-api.sh
    sudo install -m 755 /tmp/smoke-rust-api.sh /usr/local/bin/cssos-rust-smoke
    sudo systemctl restart cssos-rust-api
    sleep 2
    sudo systemctl is-active --quiet cssos-rust-api
  '

  say "api-vm: running local smoke"
  ssh api-vm '/usr/local/bin/cssos-rust-smoke'

  say "api-vm: running public smoke"
  ssh api-vm 'BASE_URL=https://cssstudio.app /usr/local/bin/cssos-rust-smoke'
}

deploy_gzvm() {
  say "gzvm: syncing rust-api and scripts"
  rsync -az --delete \
    --exclude target \
    --exclude build \
    -e 'ssh -o RemoteCommand=none -T' \
    "${REPO_ROOT}/rust-api/" \
    gzvm:/home/ubuntu/cssOS/rust-api/
  rsync -az \
    -e 'ssh -o RemoteCommand=none -T' \
    "${REPO_ROOT}/scripts/" \
    gzvm:/home/ubuntu/cssOS/scripts/
  scp -o RemoteCommand=none -T "${SMOKE_SCRIPT}" gzvm:/tmp/smoke-rust-api.sh >/dev/null

  say "gzvm: building and restarting cssos-rust-api"
  ssh -o RemoteCommand=none -T gzvm '
    set -euo pipefail
    export PATH=/home/ubuntu/.cargo/bin:$PATH
    cd /home/ubuntu/cssOS/rust-api
    cargo build --release
    sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
    install -m 755 /tmp/smoke-rust-api.sh /home/ubuntu/cssOS/scripts/smoke-rust-api.sh
    sudo install -m 755 /tmp/smoke-rust-api.sh /usr/local/bin/cssos-rust-smoke
    sudo systemctl restart cssos-rust-api
    sleep 2
    sudo systemctl is-active --quiet cssos-rust-api
  '

  say "gzvm: running local smoke"
  ssh -o RemoteCommand=none -T gzvm '/usr/local/bin/cssos-rust-smoke'

  say "gzvm: running host-routed smoke"
  ssh -o RemoteCommand=none -T gzvm \
    'SKIP_HEALTH=1 RESOLVE_HOST=zh.cssstudio.app:443:127.0.0.1 BASE_URL=https://zh.cssstudio.app CURL_OPTS="-kfsS" /usr/local/bin/cssos-rust-smoke'
}

case "${TARGET}" in
  api-vm)
    deploy_api_vm
    ;;
  gzvm)
    deploy_gzvm
    ;;
  all)
    deploy_api_vm
    deploy_gzvm
    ;;
  *)
    echo "usage: TARGET={api-vm|gzvm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac

say "done"
