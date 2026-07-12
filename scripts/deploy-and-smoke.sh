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
    # W1749 — torch-sys needs libtorch at build time (see deploy-fast.sh note).
    export LIBTORCH_USE_PYTORCH=1
    export LD_LIBRARY_PATH=/home/jing/.local/lib/python3.10/site-packages/torch/lib:${LD_LIBRARY_PATH:-}
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

case "${TARGET}" in
  api-vm|all)
    deploy_api_vm
    ;;
  *)
    echo "usage: TARGET={api-vm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac

say "done"
