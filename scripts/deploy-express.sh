#!/usr/bin/env bash

set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_REPO="/srv/cssos/repo"

say() {
  printf '[deploy-express] %s\n' "$*"
}

sync_src() {
  say "rsync src/ -> ${TARGET}:${REMOTE_REPO}/src/"
  rsync -az --delete \
    "${REPO_ROOT}/src/" \
    "${TARGET}:${REMOTE_REPO}/src/"

  if [ -d "${REPO_ROOT}/migrations" ]; then
    say "rsync migrations/ -> ${TARGET}:${REMOTE_REPO}/migrations/"
    rsync -az --delete \
      "${REPO_ROOT}/migrations/" \
      "${TARGET}:${REMOTE_REPO}/migrations/"
  fi

  say "rsync tsconfig.json + package.json -> ${TARGET}:${REMOTE_REPO}/"
  rsync -az \
    "${REPO_ROOT}/tsconfig.json" \
    "${REPO_ROOT}/package.json" \
    "${TARGET}:${REMOTE_REPO}/"
}

build_and_restart() {
  say "tsc build + install dist + restart cssOS on ${TARGET}"
  ssh "${TARGET}" '
    set -euo pipefail
    cd /srv/cssos/repo
    npm run build
    if [ ! -f dist/index.js ]; then
      echo "[deploy-express] tsc did not produce dist/index.js" >&2
      exit 1
    fi

    EXEC_LINE="$(sudo systemctl show cssOS -p ExecStart --value | head -n1)"
    RUN_JS="$(printf "%s" "$EXEC_LINE" | grep -oE "/[^ ;]+index\\.js" | head -n1)"
    if [ -z "${RUN_JS}" ]; then
      echo "[deploy-express] could not parse ExecStart for index.js path; ExecStart was: ${EXEC_LINE}" >&2
      exit 1
    fi

    RUN_JS_REAL="$(sudo readlink -f "${RUN_JS}" 2>/dev/null || true)"
    TARGET_JS="${RUN_JS_REAL:-${RUN_JS}}"
    TARGET_DIR="$(dirname "${TARGET_JS}")"
    RELEASE_DIR="$(dirname "${TARGET_DIR}")"
    echo "[deploy-express] ExecStart index.js : ${RUN_JS}"
    echo "[deploy-express] resolved to        : ${TARGET_JS}"
    echo "[deploy-express] release dir        : ${RELEASE_DIR}"

    sudo mkdir -p "${TARGET_DIR}"
    sudo rsync -a --delete dist/ "${TARGET_DIR}/"
    if [ ! -e "${RELEASE_DIR}/node_modules" ]; then
      sudo ln -sfn /srv/cssos/repo/node_modules "${RELEASE_DIR}/node_modules"
    fi
    if [ -d /srv/cssos/repo/migrations ] && [ ! -e "${RELEASE_DIR}/migrations" ]; then
      sudo ln -sfn /srv/cssos/repo/migrations "${RELEASE_DIR}/migrations"
    fi
    sudo chown -R www-data:www-data "${TARGET_DIR}"
    sudo chmod -R a+rX "${TARGET_DIR}"
    sudo systemctl reset-failed cssOS
    sudo systemctl restart cssOS
    sleep 3
    sudo systemctl is-active --quiet cssOS
  '
}

sync_src
build_and_restart
say "done"
