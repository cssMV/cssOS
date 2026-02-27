#!/usr/bin/env bash
set -euo pipefail

BASE=/srv/cssos
CUR="$(readlink -f $BASE/current)"
PUB="$CUR/public"
DEPLOY="$BASE/bin/deploy-release.sh"

echo "=== Current release ==="
echo "$CUR"
ls -lah "$PUB" | sed -n '1,80p'

# --- helper: inject menu into a given public dir ---
inject_menu () {
  local pub="$1"
  local idx="$pub/index.html"
  local app="$pub/app.js"

  echo "== Inject into: $pub =="

  [ -f "$idx" ] || { echo "Missing $idx"; return 1; }
  [ -f "$app" ] || { echo "Missing $app"; return 1; }

  # Backup once per run
  ts="$(date +%Y%m%d_%H%M%S)"
  cp -a "$idx" "$idx.bak.$ts"
  cp -a "$app" "$app.bak.$ts"

  # 1) mount point in index.html (insert after <body...>)
  if ! grep -q 'id="topLeftMenuRoot"' "$idx"; then
    perl -i -pe 'if (!$done && /<body\b[^>]*>/i) { $_ .= "\n  <div id=\"topLeftMenuRoot\"></div>\n"; $done=1 }' "$idx"
    echo "Inserted #topLeftMenuRoot in index.html"
  else
    echo "index.html already has #topLeftMenuRoot"
  fi

  # 2) append menu code to app.js (idempotent)
  if ! grep -q 'CSSOS_VERSION_MENU_BEGIN' "$app"; then
    cat >> "$app" <<'EOF'

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
    echo "Appended menu block to app.js"
  else
    echo "app.js already has menu block"
  fi
}

echo "=== A) Inject into current release now ==="
sudo -n bash -c "$(declare -f inject_menu); inject_menu '$PUB'"

echo "=== B) Patch deploy script to inject into every new release ==="
if ! sudo -n grep -q "CSSOS_VERSION_MENU_BEGIN" "$DEPLOY"; then
  sudo -n tee -a "$DEPLOY" >/dev/null <<'EOF'

# --- Inject top-left versions menu into release public assets ---
inject_menu () {
  set -euo pipefail
  local pub="$1"
  local idx="$pub/index.html"
  local app="$pub/app.js"

  [ -f "$idx" ] || return 0
  [ -f "$app" ] || return 0

  if ! grep -q 'id="topLeftMenuRoot"' "$idx"; then
    perl -i -pe 'if (!$done && /<body\b[^>]*>/i) { $_ .= "\n  <div id=\"topLeftMenuRoot\"></div>\n"; $done=1 }' "$idx"
  fi

  if ! grep -q 'CSSOS_VERSION_MENU_BEGIN' "$app"; then
    cat >> "$app" <<'MENUEOF'

/* CSSOS_VERSION_MENU_BEGIN */
;(function () {
  if (window.__cssosVersionMenuMounted) return
  window.__cssosVersionMenuMounted = true
  const root = document.getElementById('topLeftMenuRoot')
  if (!root) return

  root.innerHTML = `
    <div id="verMenu" style="position:fixed;top:14px;left:14px;z-index:2147483647;pointer-events:auto;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
      <button id="verBtn" aria-haspopup="true" aria-expanded="false" title="Versions" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.35);backdrop-filter:blur(10px);display:grid;place-content:center;gap:4px;cursor:pointer;padding:0;">
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
        <span style="width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.85);display:block;"></span>
      </button>
      <div id="verDropdown" hidden style="margin-top:10px;width:280px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.55);backdrop-filter:blur(12px);padding:10px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <div style="font-size:12px;opacity:.75;margin:2px 6px 8px;">Versions</div>
        <div id="verList" style="max-height:320px;overflow:auto;padding:2px;">Loading…</div>
      </div>
    </div>
  `
  const btn = document.getElementById('verBtn')
  const dd = document.getElementById('verDropdown')
  const listEl = document.getElementById('verList')
  function open(){ dd.hidden=false; btn.setAttribute('aria-expanded','true') }
  function close(){ dd.hidden=true; btn.setAttribute('aria-expanded','false') }
  function toggle(){ dd.hidden?open():close() }
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggle() })
  dd.addEventListener('click', (e)=>e.stopPropagation())
  document.addEventListener('click', ()=>close())

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  fetch('/versions.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(r.status)).then(data=>{
    const cur=data&&data.current
    const versions=(data&&Array.isArray(data.versions))?data.versions:[]
    if(!versions.length){listEl.textContent='No versions';return}
    listEl.innerHTML=versions.map(v=>{
      const id=(typeof v==='string')?v:v.id
      const label=(typeof v==='string')?v:(v.label||v.id)
      const path=(typeof v==='string')?(`/v/${v}`):(v.path||(`/v/${id}`))
      const isCur=id===cur
      const rowStyle=`display:flex;align-items:center;justify-content:space-between;text-decoration:none;color:rgba(255,255,255,.92);padding:10px 10px;border-radius:10px;${isCur?'outline:1px solid rgba(0,255,180,.35);background:rgba(0,255,180,.08);':''}`
      return `<a href="${esc(path)}" style="${rowStyle}"><span style="font-size:13px;">${esc(label)}</span>${isCur?`<span style="font-size:11px;opacity:.7;">current</span>`:''}</a>`
    }).join('')
  }).catch(()=>{listEl.textContent='Failed to load versions'})
})()
/* CSSOS_VERSION_MENU_END */
MENUEOF
  fi
}

# Call injection on the release public dir
inject_menu "$RELEASES_DIR/$VERSION/public"
EOF
  echo "Patched deploy script to inject menu for future releases"
else
  echo "Deploy script already contains menu injection"
fi

echo "=== Done. You can hard refresh the site now. ==="
