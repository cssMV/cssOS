#!/usr/bin/env bash
# CSSOS_PHASE2_DEPLOY 20260430 #221b + #227 — Take 2 suffix removal,
# sibling cross-link, self-first structural queue policy.
#
# 1. rsync rust-api/  → api-vm:/srv/cssos/repo/rust-api/
# 2. rsync src/       → api-vm:/srv/cssos/repo/src/
# 3. rsync public/    → api-vm:/srv/cssos/current/public/
# 4. cargo build --release on api-vm + restart cssos-rust-api
# 5. tsc build on api-vm + install dist/ + restart cssOS
# 6. smoke /cssapi/v1/mv for root_work_id + sequence_index
set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '[deploy-227] %s\n' "$*"; }

say "1/6 rsync rust-api → ${TARGET}"
rsync -az --delete \
  --exclude target --exclude build \
  --exclude '.DS_Store' --exclude '._*' --exclude '.AppleDouble' \
  "${REPO_ROOT}/rust-api/" \
  "${TARGET}:/srv/cssos/repo/rust-api/"

say "2/6 rsync src/ + tsconfig + package.json → ${TARGET}"
rsync -az --delete \
  --exclude '.DS_Store' --exclude '._*' --exclude '.AppleDouble' \
  "${REPO_ROOT}/src/" \
  "${TARGET}:/srv/cssos/repo/src/"
rsync -az \
  "${REPO_ROOT}/tsconfig.json" \
  "${REPO_ROOT}/package.json" \
  "${TARGET}:/srv/cssos/repo/"

say "3/6 rsync public/ → ${TARGET}"
rsync -az \
  --exclude '.DS_Store' --exclude '._*' --exclude '.AppleDouble' \
  "${REPO_ROOT}/public/" \
  "${TARGET}:/tmp/cssos-public-stage/"
ssh "${TARGET}" 'sudo rsync -a --delete /tmp/cssos-public-stage/ /srv/cssos/current/public/ \
  && sudo chown -R www-data:www-data /srv/cssos/current/public/'

say "4/6 cargo build --release + restart cssos-rust-api on ${TARGET}"
ssh "${TARGET}" 'set -euo pipefail
  export PATH=/home/jing/.cargo/bin:$PATH
  export LIBTORCH_USE_PYTORCH=1
  cd /srv/cssos/repo/rust-api
  cargo build --release 2>&1 | tail -25
  sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
  sudo systemctl restart cssos-rust-api
  sleep 3
  sudo systemctl is-active --quiet cssos-rust-api && echo "  cssos-rust-api active" || (echo NOT_ACTIVE; exit 1)
'

say "5/6 tsc build + install dist + restart cssOS on ${TARGET}"
ssh "${TARGET}" '
  set -euo pipefail
  cd /srv/cssos/repo
  npm run build 2>&1 | tail -20
  if [ ! -f dist/index.js ]; then
    echo "[deploy-227] tsc did not produce dist/index.js" >&2
    exit 1
  fi
  EXEC_LINE="$(sudo systemctl show cssOS -p ExecStart --value | head -n1)"
  RUN_JS="$(printf "%s" "$EXEC_LINE" | grep -oE "/[^ ;]+index\\.js" | head -n1)"
  if [ -z "${RUN_JS}" ]; then
    echo "[deploy-227] could not parse ExecStart for index.js path; ExecStart was: ${EXEC_LINE}" >&2
    exit 1
  fi
  RUN_JS_REAL="$(sudo readlink -f "${RUN_JS}" 2>/dev/null || true)"
  TARGET_JS="${RUN_JS_REAL:-${RUN_JS}}"
  TARGET_DIR="$(dirname "${TARGET_JS}")"
  RELEASE_DIR="$(dirname "${TARGET_DIR}")"
  echo "  ExecStart index.js : ${RUN_JS}"
  echo "  resolved           : ${TARGET_JS}"
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

say "6/6 smoke /cssapi/v1/mv (must include root_work_id + sequence_index)"
ssh "${TARGET}" 'curl -sS http://127.0.0.1:3000/cssapi/v1/mv?limit=4 2>&1' \
  | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get("data", {}).get("items", [])
    print(f"  items returned: {len(items)}")
    for it in items[:4]:
        rid = str(it.get("root_work_id") or "")
        sib = str(it.get("sibling_work_id") or "")
        print(f"    id={it[\"id\"][:8]}.. root={rid[:8]}.. seq={it.get(\"sequence_index\")} take={it.get(\"take_index\")} sib={sib[:8]}.. own={it.get(\"is_own\")}")
except Exception as e:
    print(f"  smoke: {e}")
' || say "  (smoke 6 needs a logged-in session — check via browser hard refresh)"

say "done. Logs: ssh ${TARGET} sudo journalctl -u cssOS -u cssos-rust-api -f"
say "  Hard-refresh browser (Cmd+Shift+R) to pick up frontend changes."
