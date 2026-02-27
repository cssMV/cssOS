#!/usr/bin/env bash
set -euo pipefail

sudo tee /srv/cssos/bin/deploy-release.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR=/srv/cssos
REPO_DIR=$BASE_DIR/repo
RELEASES_DIR=$BASE_DIR/releases
SHARED_DIR=$BASE_DIR/shared
VERSION=$(date +%Y%m%d_%H%M%S)

export VERSION

echo "== Deploying version: $VERSION =="

cd "$REPO_DIR"

# Ensure dependencies + build
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

# Create release
mkdir -p "$RELEASES_DIR/$VERSION"

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  "$REPO_DIR/" "$RELEASES_DIR/$VERSION/"

# Install production deps in release
cd "$RELEASES_DIR/$VERSION"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
cd "$REPO_DIR"

# Update current symlink
ln -sfn "$RELEASES_DIR/$VERSION" "$BASE_DIR/current"

# Update versions.json
mkdir -p "$SHARED_DIR"
VERSIONS_FILE="$SHARED_DIR/versions.json"
export VERSIONS_FILE

if [ ! -f "$VERSIONS_FILE" ]; then
  printf "%s\n" "{ \"current\": \"\", \"versions\": [] }" > "$VERSIONS_FILE"
fi

python3 - <<PY
import json, os
file = os.environ["VERSIONS_FILE"]
version = os.environ["VERSION"]
with open(file, "r", encoding="utf-8") as f:
    data = json.load(f)
if not isinstance(data, dict):
    data = {"current": "", "versions": []}
versions = data.get("versions") or []
data["current"] = version
if not any(v.get("id") == version for v in versions):
    versions.insert(0, {
        "id": version,
        "label": version,
        "path": "/v/" + version,
        "createdAt": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    })
data["versions"] = versions
with open(file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PY

# --- Shared assets linking (fonts/examples) ---
SHARED_DIR=/srv/cssos/shared
mkdir -p "$SHARED_DIR/assets/fonts" "$SHARED_DIR/assets/examples"

if [ -d "$SHARED_DIR/assets/examples/examples" ]; then
  rsync -a "$SHARED_DIR/assets/examples/examples/" "$SHARED_DIR/assets/examples/"
  rm -rf "$SHARED_DIR/assets/examples/examples"
fi

if [ -d "$RELEASES_DIR/$VERSION/public" ]; then
  rm -rf "$RELEASES_DIR/$VERSION/public/fonts"
  ln -sfn "$SHARED_DIR/assets/fonts" "$RELEASES_DIR/$VERSION/public/fonts"

  mkdir -p "$RELEASES_DIR/$VERSION/public/assets"
  rm -rf "$RELEASES_DIR/$VERSION/public/assets/examples"
  ln -sfn "$SHARED_DIR/assets/examples" "$RELEASES_DIR/$VERSION/public/assets/examples"
fi

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

  // Inject tiny CSS once (spinner + input)
  if (!document.getElementById('cssosVerMenuStyle')) {
    const st = document.createElement('style')
    st.id = 'cssosVerMenuStyle'
    st.textContent = `
      @keyframes cssosSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .cssos-spin { width:18px;height:18px;border-radius:999px;border:2px solid rgba(255,255,255,.25);border-top-color:rgba(255,255,255,.85);animation:cssosSpin .8s linear infinite; }
      .cssos-search { width:100%; box-sizing:border-box; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:rgba(255,255,255,.92); padding:10px 10px; outline:none; }
      .cssos-search::placeholder { color: rgba(255,255,255,.45); }
      .cssos-row { display:flex; align-items:center; justify-content:space-between; text-decoration:none; color:rgba(255,255,255,.92); padding:10px 10px; border-radius:10px; }
      .cssos-row:hover { background:rgba(255,255,255,.08); }
      .cssos-cur { outline:1px solid rgba(0,255,180,.35); background:rgba(0,255,180,.08); }
    `
    document.head.appendChild(st)
  }

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
        width: 300px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(12px);
        padding: 10px;
        box-shadow: 0 20px 60px rgba(0,0,0,.5);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 6px 8px;">
          <div style="font-size:12px;opacity:.75;">Versions</div>
          <div id="verStatus" style="font-size:11px;opacity:.55;"></div>
        </div>
        <div style="padding:0 2px 8px;">
          <input id="verSearch" class="cssos-search" placeholder="Search versions…" />
        </div>
        <div id="verList" style="max-height: 320px; overflow:auto; padding: 2px;"></div>
      </div>
    </div>
  `

  const btn = document.getElementById('verBtn')
  const dd = document.getElementById('verDropdown')
  const listEl = document.getElementById('verList')
  const statusEl = document.getElementById('verStatus')
  const searchEl = document.getElementById('verSearch')

  let loaded = false
  let dataCache = null

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function open() { dd.hidden = false; btn.setAttribute('aria-expanded', 'true') }
  function close(){ dd.hidden = true;  btn.setAttribute('aria-expanded', 'false') }
  function toggle(){ dd.hidden ? open() : close() }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation()
    toggle()
    if (!dd.hidden) {
      await ensureLoaded()
      setTimeout(() => searchEl && searchEl.focus(), 0)
    }
  })
  dd.addEventListener('click', (e) => e.stopPropagation())
  document.addEventListener('click', () => close())

  function renderList(filterText) {
    const data = dataCache
    if (!data) return

    const cur = data.current
    const versions = Array.isArray(data.versions) ? data.versions : []
    const q = (filterText || '').trim().toLowerCase()

    const items = versions
      .map((v) => {
        const id = (typeof v === 'string') ? v : v.id
        const label = (typeof v === 'string') ? v : (v.label || v.id)
        const path = (typeof v === 'string') ? (`/v/${v}`) : (v.path || (`/v/${id}`))
        const createdAt = (typeof v === 'string') ? '' : (v.createdAt || '')
        return { id, label, path, createdAt }
      })
      .filter((it) => {
        if (!q) return true
        return (
          (it.id || '').toLowerCase().includes(q) ||
          (it.label || '').toLowerCase().includes(q) ||
          (it.createdAt || '').toLowerCase().includes(q)
        )
      })

    if (!items.length) {
      listEl.innerHTML = `<div style="padding:10px 8px; font-size:12px; opacity:.7;">No matches</div>`
      return
    }

    listEl.innerHTML = items.map((it) => {
      const isCur = it.id === cur
      const cls = `cssos-row ${isCur ? 'cssos-cur' : ''}`
      return `
        <a class="${cls}" href="${esc(it.path)}">
          <span style="font-size:13px;max-width:215px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.label)}</span>
          <span style="font-size:11px;opacity:.6;">${isCur ? 'current' : ''}</span>
        </a>
      `
    }).join('')
  }

  async function ensureLoaded() {
    if (loaded) {
      statusEl.textContent = ''
      renderList(searchEl.value)
      return
    }

    statusEl.innerHTML = `<span class="cssos-spin" aria-label="Loading"></span>`
    listEl.innerHTML = `<div style="padding:12px 10px; display:flex; align-items:center; gap:10px; opacity:.8;">
      <span class="cssos-spin"></span><span style="font-size:12px;">Loading…</span>
    </div>`

    try {
      const r = await fetch('/versions.json', { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      const data = await r.json()
      dataCache = data
      loaded = true
      statusEl.textContent = ''
      renderList(searchEl.value)
    } catch (err) {
      statusEl.textContent = ''
      listEl.innerHTML = `<div style="padding:10px 8px; font-size:12px; opacity:.75;">
        Failed to load versions. (HTTPS config?)<br/>
        <span style="opacity:.6;">Try refresh.</span>
      </div>`
    }
  }

  searchEl.addEventListener('input', () => {
    if (!loaded) return
    renderList(searchEl.value)
  })
})()
/* CSSOS_VERSION_MENU_END */
MENUEOF
  fi
}

inject_menu "$RELEASES_DIR/$VERSION/public"

# Cleanup old releases (keep last 10 by default)
KEEP=${KEEP:-10} /srv/cssos/bin/cleanup-releases.sh

echo "== Restarting service =="
systemctl restart cssOS

echo "== Deploy complete =="
echo "Current => $(readlink -f $BASE_DIR/current)"
EOF

sudo chmod +x /srv/cssos/bin/deploy-release.sh

echo "Deploy script reset."
