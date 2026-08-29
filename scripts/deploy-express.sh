#!/usr/bin/env bash

set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_REPO="/srv/cssos/repo"

say() {
  printf '[deploy-express] %s\n' "$*"
}

# CSSOS_WAVE_2031 20260829 — 【本地 typecheck 闸门, 不过不许发】。
#
# 起因: 我改完 src/index.ts, 本地 `npx tsc --noEmit` 是【红的】, 而这个脚本
# 照样一路跑到 "done"。我据此告诉 Jing"正在部署", 其实线上跑的是【上一版 build】,
# 重跑对齐当然还是旧结果 —— 我对他说了一句错话, 而脚本没有任何地方拦我。
#
# 远端虽然也 tsc, 但那时源码已经 rsync 过去、可能已经动了半个环境;
# 更要命的是失败信号没能一路冒到这里, 最后打印的仍是成功的收尾行。
# 闸门装在【最前面】: 一行代码都还没出本机, 就先判生死。
#
# 跳过方式只有一个, 而且必须是人显式写出来的: DEPLOY_SKIP_TYPECHECK=1。
# 留这个口子是为了紧急回滚(线上着火时不该被 tsc 拦住), 不是为了图快。
if [ "${DEPLOY_SKIP_TYPECHECK:-0}" != "1" ]; then
  say "typecheck (npx tsc --noEmit) — 不过不发"
  if ! (cd "${REPO_ROOT}" && npx tsc --noEmit); then
    say "❌ typecheck 失败 —— 【没有部署任何东西】, 线上仍是上一版。"
    say "   修好再发; 紧急情况可 DEPLOY_SKIP_TYPECHECK=1 强发(会带着类型错误上线)。"
    exit 1
  fi
  say "typecheck ✅"
fi

sync_src() {
  say "rsync src/ -> ${TARGET}:${REMOTE_REPO}/src/"
  rsync -az --delete \
    "${REPO_ROOT}/src/" \
    "${TARGET}:${REMOTE_REPO}/src/"

  if [ -d "${REPO_ROOT}/migrations" ]; then
    say "rsync migrations/ -> ${TARGET}:${REMOTE_REPO}/migrations/"
    # CSSOS_WAVE_170 20260515 — force a-r on migrations so the cssOS
    # systemd user (which runs as www-data inside the release dir)
    # never hits EACCES if a local file lands with mode 0600.
    rsync -az --delete --chmod=Fa+r \
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
