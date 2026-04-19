#!/usr/bin/env bash
# CSSOS_PHASE2_MV_DEPLOY 20260417 —
# Ships the browser-orchestrated MV pipeline (Phase 2) to api-vm:
#   1. rsync rust-api + scripts/ → api-vm:/srv/cssos/repo/
#   2. cargo build --release, install binary, restart cssos-rust-api
#   3. rsync public/ → api-vm:/srv/cssos/current/  (safe backup first)
#   4. run local smoke + public smoke (through cssstudio.app)
#   5. spot-check /api/mv/cover returns 401 for anonymous (sanity: route is live)
#
# Assumes ~/.ssh/config already maps `api-vm`. Run from a dev box that has
# write access to the repo — NOT from inside the api-vm itself.
#
# Usage:
#   scripts/deploy-phase2-mv.sh                # full deploy
#   SKIP_BUILD=1 scripts/deploy-phase2-mv.sh   # re-sync public only, skip cargo
#   SKIP_PUBLIC=1 scripts/deploy-phase2-mv.sh  # backend only, no static sync

set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="${REPO_ROOT}/scripts/smoke-rust-api.sh"
REMOTE_REPO="/srv/cssos/repo"
# CSSOS_STATIC_TARGET_FIX 20260418 — on api-vm the live site is served by the
# Express app (cssOS.service on :3000) which reads /srv/cssos/current/public/
# (current is a symlink → /srv/cssos/releases/<id>). We must rsync INTO the
# public/ subdir, not into current/. Putting files at current root pollutes
# the release root and leaves public/ empty → Express 404.
REMOTE_STATIC="/srv/cssos/current/public"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

say() {
  printf '[phase2-deploy] %s\n' "$*"
}

require_smoke() {
  if [[ ! -x "${SMOKE_SCRIPT}" ]]; then
    echo "[phase2-deploy] missing/non-exec smoke script: ${SMOKE_SCRIPT}" >&2
    exit 1
  fi
}

sync_rust_api() {
  # CSSOS_PHASE2_P2_56_HARDEN 20260418 — announce local git HEAD so it's
  # obvious when the deploy box is behind. We don't require a clean working
  # tree (dev iteration is fine), but drift between the deployed binary and
  # `git log` should be intentional not silent.
  if git -C "${REPO_ROOT}" rev-parse --git-dir >/dev/null 2>&1; then
    local head_sha head_msg
    head_sha=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "???")
    head_msg=$(git -C "${REPO_ROOT}" log -1 --format='%s' 2>/dev/null || echo "(no log)")
    say "local git HEAD: ${head_sha}  '${head_msg}'"
    if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain rust-api/ 2>/dev/null)" ]]; then
      say "⚠️  rust-api/ has uncommitted changes — deploying working copy"
    fi
  fi

  say "rsync rust-api/ → ${TARGET}:${REMOTE_REPO}/rust-api/"
  # CSSOS_PHASE2_P2_56_HARDEN 20260418 — exclude macOS metadata turds.
  # `.DS_Store` / `._*` AppleDouble files have leaked into /srv/cssos/
  # multiple times and broken perms. Belt them here at rsync time.
  rsync -az --delete \
    --exclude target \
    --exclude build \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '.AppleDouble' \
    "${REPO_ROOT}/rust-api/" \
    "${TARGET}:${REMOTE_REPO}/rust-api/"

  say "rsync scripts/ → ${TARGET}:${REMOTE_REPO}/scripts/"
  rsync -az \
    --exclude '.DS_Store' \
    --exclude '._*' \
    "${REPO_ROOT}/scripts/" \
    "${TARGET}:${REMOTE_REPO}/scripts/"

  scp "${SMOKE_SCRIPT}" "${TARGET}:/tmp/smoke-rust-api.sh" >/dev/null
}

build_and_restart() {
  say "cargo build + restart cssos-rust-api on ${TARGET}"
  # CSSOS_PHASE2_TCH_LIBTORCH 20260417 — tch-rs (pulled in by video_diffusion/
  # video_vae/distributed training modules) needs libtorch at build time. We
  # piggy-back on the PyTorch install that already ships with the ML pipeline
  # scripts. If the installed pytorch doesn't match tch's expected ABI the
  # caller can override LIBTORCH_USE_PYTORCH / set LIBTORCH manually before
  # calling this script.
  ssh "${TARGET}" '
    set -euo pipefail
    export PATH=/home/jing/.cargo/bin:$PATH
    export LIBTORCH_USE_PYTORCH="${LIBTORCH_USE_PYTORCH:-1}"
    # Uncomment if pytorch version drifts ahead of tch 0.15s expected libtorch:
    # export LIBTORCH_BYPASS_VERSION_CHECK=1
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
  # Safe-publish: snapshot the old static dir first so we can roll back if
  # the new HTML/JS/CSS breaks a live session.
  say "snapshotting ${REMOTE_STATIC} on ${TARGET} before publishing new static"
  ssh "${TARGET}" "
    set -euo pipefail
    if [ -d ${REMOTE_STATIC} ]; then
      sudo cp -a ${REMOTE_STATIC} ${REMOTE_STATIC}.bak.${STAMP}
    fi
  "

  say "rsync public/ → ${TARGET}:${REMOTE_STATIC}/ (via sudo rsync on remote)"
  # --rsync-path='sudo rsync' runs rsync as root on the remote, so we can
  # write into /srv/cssos/current (root-owned) and also opendir root-owned
  # subtrees (e.g. secure/) without permission errors.
  #
  # Exclude persistent runtime dirs from --delete so we never blow away
  # user uploads or signed static assets that don't live in the git repo:
  #   - secure/  : root-owned signed-URL content dir
  #   - public/  : runtime-written user artifacts dir
  #   - artifacts/, uploads/, works/ : user-generated media buckets
  #
  # CSSOS_PHASE2_CHMOD_FIX 20260418 — force "world-readable" perms on synced
  # files/dirs regardless of what the local macOS source mode is (dev-box
  # files are often 600 rw-------). Express on :3000 may run as a non-jing
  # user (www-data / root / dedicated svc user); without this, GET returns
  # 500 ISE while HEAD succeeds (stat vs read).
  #
  # We use symbolic chmod (a+rX) instead of D755,F644 because macOS ships
  # rsync 2.6.9 whose chmod parser rejects the D/F numeric syntax with
  # "--chmod=D755,F644: invalid argument". a+rX is portable to every rsync
  # version and does the right thing:
  #   - a+r : grant read to all (user/group/other)
  #   - +X  : grant execute to all, but ONLY on directories and on files
  #           that were already executable for at least one user
  # Effect:
  #   - 600 regular file  (rw-------) → 644 (rw-r--r--)  ✓ Express can GET
  #   - 700 directory     (rwx------) → 755 (rwxr-xr-x)  ✓ Express opendir ok
  #   - 644 / 755 already-correct     → unchanged
  # CSSOS_PHASE2_P2_56_HARDEN 20260418 — exclude macOS metadata turds. These
  # files (`.DS_Store`, AppleDouble `._*`, Spotlight/Trashes, Windows `Thumbs.db`)
  # have leaked into /srv/cssos/ on THREE separate deploys and caused Express
  # ISE 500 every time (they rsync up owned by jing:staff, www-data can't read
  # the directory, and the read error cascades to index.html). Fenced for good.
  rsync -az --delete \
    --chmod=a+rX \
    --rsync-path='sudo rsync' \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '.AppleDouble' \
    --exclude '.AppleDB' \
    --exclude '.Spotlight-V100' \
    --exclude '.Trashes' \
    --exclude '.fseventsd' \
    --exclude 'Thumbs.db' \
    --exclude 'app.js.bak.*' \
    --exclude 'secure/' \
    --exclude 'public/' \
    --exclude 'artifacts/' \
    --exclude 'uploads/' \
    --exclude 'works/' \
    "${REPO_ROOT}/public/" \
    "${TARGET}:${REMOTE_STATIC}/"

  # CSSOS_PHASE2_P2_56_HARDEN 20260418 — belt-and-suspenders ownership fix.
  # Even with rsync --chmod=a+rX, files still land with inherited ownership
  # from whoever ran the rsync. The Mac's `jing:staff` uid/gid numerically
  # maps to random accounts on Linux (often 501:20 → some system user), and
  # Express runs as www-data which then can't open() the files. Explicitly
  # flip ownership here, and scrub any .DS_Store that snuck in from a
  # pre-P2-56 deploy (this dir may still have turds from earlier bad runs).
  ssh "${TARGET}" "
    set -euo pipefail
    sudo find ${REMOTE_STATIC} -name '.DS_Store' -delete 2>/dev/null || true
    sudo find ${REMOTE_STATIC} -name '._*' -delete 2>/dev/null || true
    sudo chown -R www-data:www-data ${REMOTE_STATIC}
    sudo chmod -R a+rX ${REMOTE_STATIC}
    # Bump mtime so any CDN in front of us re-fetches.
    sudo touch ${REMOTE_STATIC}/index.html || true
  "
}

# CSSOS_PHASE2_P2_56_HARDEN 20260418 — post-deploy health check that auto-rolls
# back on failure. Previously the deploy script declared "done" as soon as the
# smoke script (which only tests a couple auth-gated routes) passed. That's why
# permission-broken deploys repeatedly shipped to production without detection
# — the smoke hit /api/* which was fine, never hit /index.html (EACCES). This
# check hits the three endpoints users actually see and rolls back the static
# snapshot on any non-200.
verify_or_rollback() {
  say "health check — /, mv-panel JS, rust health"
  local fail=0
  ssh "${TARGET}" "
    set +e
    bad=0
    for u in http://127.0.0.1:3000/ http://127.0.0.1:3000/app.mv-pipeline-panel.js http://127.0.0.1:8081/api/health; do
      code=\$(curl -sS --max-time 6 -o /dev/null -w '%{http_code}' \"\$u\")
      if [ \"\$code\" = '200' ]; then
        printf '  ✓ %-60s HTTP %s\n' \"\$u\" \"\$code\"
      else
        printf '  ✗ %-60s HTTP %s\n' \"\$u\" \"\$code\" >&2
        bad=1
      fi
    done
    exit \$bad
  " || fail=1

  if [ "${fail}" -ne 0 ]; then
    say "❌ HEALTH CHECK FAILED — rolling back static to pre-deploy snapshot"
    ssh "${TARGET}" "
      set +e
      if [ -d ${REMOTE_STATIC}.bak.${STAMP} ]; then
        sudo rsync -a --delete ${REMOTE_STATIC}.bak.${STAMP}/ ${REMOTE_STATIC}/
        sudo chown -R www-data:www-data ${REMOTE_STATIC}
        sudo chmod -R a+rX ${REMOTE_STATIC}
        sudo systemctl restart cssOS
        echo '[phase2-deploy] ⏪ ROLLED BACK to pre-deploy snapshot ${STAMP}'
      else
        echo '[phase2-deploy] ⚠️  no snapshot found at ${REMOTE_STATIC}.bak.${STAMP} — cannot roll back'
      fi
    "
    exit 1
  fi
  say "✅ health check passed — deploy clean"
}

run_smoke() {
  say "local smoke on ${TARGET}"
  ssh "${TARGET}" '/usr/local/bin/cssos-rust-smoke'

  say "public smoke through cssstudio.app"
  ssh "${TARGET}" 'BASE_URL=https://cssstudio.app /usr/local/bin/cssos-rust-smoke'

  say "spot-check /api/mv/cover returns 401 for anonymous (route is live, auth enforced)"
  ssh "${TARGET}" "
    set +e
    code=\$(curl -s -o /dev/null -w '%{http_code}' -X POST \
       -H 'Content-Type: application/json' \
       -d '{\"prompt\":\"smoke\"}' \
       http://127.0.0.1:8081/api/mv/cover)
    echo \"[phase2-deploy] /api/mv/cover anon → HTTP \$code\"
    if [ \"\$code\" != '401' ] && [ \"\$code\" != '503' ]; then
      echo '[phase2-deploy] FAIL: expected 401 (no session) or 503 (no API key); got' \$code >&2
      exit 1
    fi
  "
}

require_smoke

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  sync_rust_api
  build_and_restart
else
  say "SKIP_BUILD=1 → skipping rust-api sync + cargo build"
fi

if [[ "${SKIP_PUBLIC:-0}" != "1" ]]; then
  sync_public
else
  say "SKIP_PUBLIC=1 → skipping public/ sync"
fi

run_smoke
verify_or_rollback
say "done (stamp ${STAMP})"
