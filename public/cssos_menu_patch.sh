#!/usr/bin/env bash
set -euo pipefail

cd /srv/cssos/repo

echo "=== 1) set git identity (repo-local) ==="
git config user.name "CSS Studio"
git config user.email "admin@cssstudio.app"

echo "=== 2) discard local uncommitted changes (keep backups already created) ==="
git reset --hard
git clean -fd

echo "=== 3) fast-forward to latest main ==="
git fetch --all --tags
git checkout main
git pull --ff-only

echo "=== 4) re-apply menu patch (idempotent) ==="
ts="$(date +%Y%m%d_%H%M%S)"
cp -a public/index.html "public/index.html.bak.$ts"
cp -a public/app.js     "public/app.js.bak.$ts"

# mount point
if ! grep -q 'id="topLeftMenuRoot"' public/index.html; then
  perl -i -pe 'if (!$done && /<body\b[^>]*>/i) { $_ .= "\n  <div id=\"topLeftMenuRoot\"></div>\n"; $done=1 }' public/index.html
fi

# menu block
if ! grep -q 'CSSOS_VERSION_MENU_BEGIN' public/app.js; then
  cat >> public/app.js <<'EOF'

/* CSSOS_VERSION_MENU_BEGIN */
;(function () {
  if (window.__cssosVersionMenuMounted) return
  window.__cssosVersionMenuMounted = true

  const root = document.getElementById('topLeftMenuRoot')
  if (!root) return

  root.innerHTML = `
    <div id="verMenu" style="
      position: fixed;
      top: 14px;
      left: 14px;
      z-index: 2147483647;
      pointer-events: auto;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    ">
      <button id="verBtn" aria-haspopup="true" aria-expanded="false" title="Versions" style="
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.15);
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        display: grid;
        place-content: center;
        gap: 4px;
        cursor: pointer;
        padding: 0;
      ">
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
      </button>

      <div id="verDropdown" hidden style="
        margin-top: 10px;
        width: 280px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(12px);
        padding: 10px;
        box-shadow: 0 20px 60px rgba(0,0,0,.5);
      ">
        <div style="font-size:12px;opacity:.75;margin:2px 6px 8px;">Versions</div>
        <div id="verList" style="max-height: 320px; overflow:auto; padding: 2px;">Loading…</div>
      </div>
    </div>
  `

  const btn = document.getElementById('verBtn')
  const dd = document.getElementById('verDropdown')
  const listEl = document.getElementById('verList')

  function open() { dd.hidden = false; btn.setAttribute('aria-expanded', 'true') }
  function close(){ dd.hidden = true;  btn.setAttribute('aria-expanded', 'false') }
  function toggle(){ dd.hidden ? open() : close() }

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle() })
  dd.addEventListener('click', (e) => e.stopPropagation())
  document.addEventListener('click', () => close())

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  fetch('/versions.json', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject(r.status))
    .then((data) => {
      const cur = data && data.current
      const versions = (data && Array.isArray(data.versions)) ? data.versions : []
      if (!versions.length) { listEl.textContent = 'No versions'; return }

      listEl.innerHTML = versions.map((v) => {
        const id = (typeof v === 'string') ? v : v.id
        const label = (typeof v === 'string') ? v : (v.label || v.id)
        const path = (typeof v === 'string') ? (`/v/${v}`) : (v.path || (`/v/${id}`))
        const isCur = id === cur

        const rowStyle = `
          display:flex;align-items:center;justify-content:space-between;
          text-decoration:none;color:rgba(255,255,255,.92);
          padding:10px 10px;border-radius:10px;
          ${isCur ? 'outline:1px solid rgba(0,255,180,.35);background:rgba(0,255,180,.08);' : ''}
        `
        return `
          <a href="${escapeHtml(path)}" style="${rowStyle}">
            <span style="font-size:13px;">${escapeHtml(label)}</span>
            ${isCur ? `<span style="font-size:11px;opacity:.7;">current</span>` : ``}
          </a>
        `
      }).join('')
    })
    .catch(() => { listEl.textContent = 'Failed to load versions' })
})()
/* CSSOS_VERSION_MENU_END */
EOF
fi

echo "=== 5) commit + push ==="
git add public/index.html public/app.js
git commit -m "ui: add top-left versions menu" || echo "Nothing to commit"
git push origin main

echo "DONE"
