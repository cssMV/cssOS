#!/usr/bin/env bash

set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="${REPO_ROOT}/scripts/smoke-rust-api.sh"
REMOTE_REPO="/srv/cssos/repo"
REMOTE_STATIC="/srv/cssos/current/public"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

say() {
  printf '[deploy] %s\n' "$*"
}

require_smoke() {
  if [[ ! -x "${SMOKE_SCRIPT}" ]]; then
    echo "[deploy] missing/non-exec smoke script: ${SMOKE_SCRIPT}" >&2
    exit 1
  fi
}

sync_rust_api() {
  say "rsync rust-api/ -> ${TARGET}:${REMOTE_REPO}/rust-api/"
  rsync -az --delete \
    --exclude target \
    --exclude build \
    "${REPO_ROOT}/rust-api/" \
    "${TARGET}:${REMOTE_REPO}/rust-api/"

  say "rsync scripts/ -> ${TARGET}:${REMOTE_REPO}/scripts/"
  rsync -az \
    "${REPO_ROOT}/scripts/" \
    "${TARGET}:${REMOTE_REPO}/scripts/"

  scp "${SMOKE_SCRIPT}" "${TARGET}:/tmp/smoke-rust-api.sh" >/dev/null
}

build_and_restart() {
  say "cargo build + restart cssos-rust-api on ${TARGET}"
  ssh "${TARGET}" '
    set -euo pipefail
    export PATH=/home/jing/.cargo/bin:$PATH
    export LIBTORCH_USE_PYTORCH="${LIBTORCH_USE_PYTORCH:-1}"
    cd /srv/cssos/repo/rust-api
    cargo build --release
    sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
    sudo install -m 755 /tmp/smoke-rust-api.sh /usr/local/bin/cssos-rust-smoke
    sudo systemctl restart cssos-rust-api
    sleep 2
    sudo systemctl is-active --quiet cssos-rust-api
  '
}

sync_public() {
  # CSSOS_WAVE_503 20260530 — Jing: 防止部署快照堆满磁盘(曾累积 31×2.5G=75G → 盘满)。
  #   1) 快照排除大运行时目录(artifacts/uploads/works/secure — 它们本就不部署);
  #   2) 部署前先清理旧快照, 只保留最近 1 份。
  say "snapshot ${REMOTE_STATIC} on ${TARGET} (lightweight, pruning old)"
  ssh "${TARGET}" "
    set -euo pipefail
    # Prune old snapshots — keep only the most recent one (|| true so 'no match' is fine).
    { ls -1dt ${REMOTE_STATIC}.bak.* 2>/dev/null || true; } | tail -n +2 | sudo xargs -r rm -rf
    if [ -d ${REMOTE_STATIC} ]; then
      sudo rsync -a --delete \
        --exclude 'artifacts/' --exclude 'uploads/' --exclude 'works/' --exclude 'secure/' \
        --exclude '*.bak.*' \
        ${REMOTE_STATIC}/ ${REMOTE_STATIC}.bak.${STAMP}/
    fi
  "

  say "rsync public/ -> ${TARGET}:${REMOTE_STATIC}/"
  rsync -az --delete \
    --chmod=a+rX \
    --rsync-path='sudo rsync' \
    --exclude 'app.js.bak.*' \
    --exclude 'secure/' \
    --exclude 'public/' \
    --exclude 'artifacts/' \
    --exclude 'uploads/' \
    --exclude 'works/' \
    --exclude 'fonts/' \
    --exclude 'fonts_cn2/' \
    --exclude 'fonts_en/' \
    "${REPO_ROOT}/public/" \
    "${TARGET}:${REMOTE_STATIC}/"

  ssh "${TARGET}" "
    sudo chmod -R a+rX /srv/cssos/releases/
    # CSSOS_WAVE_1082 — 根治 i18n/静态 600→500 反复发作: 必须 chmod【真正被服务的 current/public】
    # (此前只 chmod releases/, 漏了 current/public → dict.js 等残留 600 → nginx 500 → i18n 全站漏键)。
    sudo chmod -R a+rX ${REMOTE_STATIC}
    sudo chmod a+X /srv/cssos /srv/cssos/releases /srv/cssos/current
    # CSSOS_WAVE_1107b 20260622 — Jing 显式护栏: i18n/dict.js 等反复掉 600 → nginx 500 → 全站漏键
    # (满屏 dock.* / logo.slogan 原始 key)。专门把被服务的 i18n 脚本钉死 644, 即使上面 -R 那行
    # 被改/被某个运行时词典重生成绕过, 这道也兜底。
    sudo chmod 644 ${REMOTE_STATIC}/i18n/*.js 2>/dev/null || true
    sudo find ${REMOTE_STATIC}/i18n -type f -name '*.js' -exec sudo chmod 644 {} + 2>/dev/null || true
    sudo touch ${REMOTE_STATIC}/index.html || true
  "
}

run_smoke() {
  say "local smoke on ${TARGET}"
  ssh "${TARGET}" '/usr/local/bin/cssos-rust-smoke'

  say "public smoke through cssstudio.app"
  ssh "${TARGET}" 'BASE_URL=https://cssstudio.app /usr/local/bin/cssos-rust-smoke'

  say "spot-check /api/mv/cover anon"
  ssh "${TARGET}" "
    set +e
    code=\$(curl -s -o /dev/null -w '%{http_code}' -X POST \
       -H 'Content-Type: application/json' \
       -d '{\"prompt\":\"smoke\"}' \
       http://127.0.0.1:8081/api/mv/cover)
    echo \"[deploy] /api/mv/cover anon -> HTTP \$code\"
    if [ \"\$code\" != '401' ] && [ \"\$code\" != '503' ]; then
      echo '[deploy] FAIL: expected 401 or 503; got' \$code >&2
      exit 1
    fi
  "
}

require_smoke

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  sync_rust_api
  build_and_restart
else
  say "SKIP_BUILD=1"
fi

if [[ "${SKIP_PUBLIC:-0}" != "1" ]]; then
  sync_public
else
  say "SKIP_PUBLIC=1"
fi

run_smoke
say "done (stamp ${STAMP})"
