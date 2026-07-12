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
    # W1749 — torch-sys needs libtorch at build time. The 4-month-old cache was
    # invalidated by the toolchain bump, so cold builds must locate libtorch.
    # Use the installed PyTorch. Keeping this here makes the env deterministic
    # (torch-sys tracks LIBTORCH_USE_PYTORCH via rerun-if-env-changed, so it must
    # be identical across builds or the cache thrashes).
    export LIBTORCH_USE_PYTORCH=1
    export LD_LIBRARY_PATH=/home/jing/.local/lib/python3.10/site-packages/torch/lib:${LD_LIBRARY_PATH:-}
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

require_smoke

case "${TARGET}" in
  api-vm)
    deploy_api_vm
    ;;
  *)
    echo "usage: TARGET={api-vm} $(basename "$0")" >&2
    exit 1
    ;;
esac

say "done"
