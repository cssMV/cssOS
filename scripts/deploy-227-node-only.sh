#!/usr/bin/env bash
# CSSOS_PHASE2_DEPLOY 20260430 #227 — Node-only step (steps 5/6 of full
# deploy-227.sh). Use when rust-api + public/ are already in place but the
# Node service still needs the new TypeScript build deployed.
set -euo pipefail

TARGET="${TARGET:-api-vm}"
say() { printf '[deploy-227-node] %s\n' "$*"; }

say "tsc build + install dist + restart cssOS on ${TARGET}"
ssh "${TARGET}" '
  set -euo pipefail
  cd /srv/cssos/repo
  npm run build 2>&1 | tail -20
  if [ ! -f dist/index.js ]; then
    echo "[deploy] tsc did not produce dist/index.js" >&2
    exit 1
  fi
  EXEC_LINE="$(sudo systemctl show cssOS -p ExecStart --value | head -n1)"
  RUN_JS="$(printf "%s" "$EXEC_LINE" | grep -oE "/[^ ;]+index\\.js" | head -n1)"
  RUN_JS_REAL="$(sudo readlink -f "${RUN_JS}" 2>/dev/null || true)"
  TARGET_JS="${RUN_JS_REAL:-${RUN_JS}}"
  TARGET_DIR="$(dirname "${TARGET_JS}")"
  RELEASE_DIR="$(dirname "${TARGET_DIR}")"
  echo "  ExecStart index.js : ${RUN_JS}"
  sudo mkdir -p "${TARGET_DIR}"
  sudo rsync -a --delete dist/ "${TARGET_DIR}/"
  if [ ! -e "${RELEASE_DIR}/node_modules" ]; then
    sudo ln -sfn /srv/cssos/repo/node_modules "${RELEASE_DIR}/node_modules"
  fi
  sudo chown -R www-data:www-data "${TARGET_DIR}"
  sudo chmod -R a+rX "${TARGET_DIR}"
  sudo systemctl reset-failed cssOS
  sudo systemctl restart cssOS
  sleep 3
  sudo systemctl is-active --quiet cssOS && echo "  cssOS active" || (echo NOT_ACTIVE; exit 1)
'
say "done."
