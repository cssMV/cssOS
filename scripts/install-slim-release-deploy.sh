#!/usr/bin/env bash
set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() {
  printf '[slim-release] %s\n' "$*"
}

build_remote_script() {
  local base_dir="$1"
  cat <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR=__BASE_DIR__
REPO_DIR=$BASE_DIR/repo
RELEASES_DIR=$BASE_DIR/releases
SHARED_DIR=$BASE_DIR/shared
VERSION=$(date +%Y%m%d_%H%M%S)

if [ -f /etc/cssstudio/cssstudio.env ]; then
  set -a
  . /etc/cssstudio/cssstudio.env
  set +a
fi

export VERSION

echo "== Deploying slim release: $VERSION =="

cd "$REPO_DIR"

if [ -f package-lock.json ]; then
  npm ci --include=dev
else
  npm install
fi

npm run build

mkdir -p "$RELEASES_DIR/$VERSION"

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "rust-api" \
  --exclude "registry" \
  --exclude "remote-rust-api" \
  --exclude "backups" \
  --exclude "tmp_audio" \
  --exclude "tests" \
  --exclude "examples" \
  "$REPO_DIR/" "$RELEASES_DIR/$VERSION/"

cd "$RELEASES_DIR/$VERSION"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
if [ ! -d "$RELEASES_DIR/$VERSION/node_modules" ] || [ ! -d "$RELEASES_DIR/$VERSION/node_modules/express" ]; then
  rm -rf "$RELEASES_DIR/$VERSION/node_modules"
  ln -sfn "$REPO_DIR/node_modules" "$RELEASES_DIR/$VERSION/node_modules"
fi
cd "$REPO_DIR"

if [ ! -d "$REPO_DIR/public" ] || [ ! -f "$REPO_DIR/public/index.html" ]; then
  echo "ERROR: repo missing public/index.html" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR/$VERSION/public"
rsync -a --delete --exclude "examples" "$REPO_DIR/public/" "$RELEASES_DIR/$VERSION/public/"
chmod -R a+rX "$RELEASES_DIR/$VERSION/public" "$RELEASES_DIR/$VERSION/dist" "$RELEASES_DIR/$VERSION/scripts" || true

mkdir -p "$SHARED_DIR/assets/fonts" "$SHARED_DIR/assets/examples"

rm -rf "$RELEASES_DIR/$VERSION/public/fonts"
ln -sfn "$SHARED_DIR/assets/fonts" "$RELEASES_DIR/$VERSION/public/fonts"

mkdir -p "$RELEASES_DIR/$VERSION/public/assets"
rm -rf "$RELEASES_DIR/$VERSION/public/assets/examples"
ln -sfn "$SHARED_DIR/assets/examples" "$RELEASES_DIR/$VERSION/public/assets/examples"

if [ ! -f "$RELEASES_DIR/$VERSION/public/index.html" ]; then
  echo "ERROR: slim release missing public/index.html" >&2
  exit 1
fi
if ! test -f "$RELEASES_DIR/$VERSION/public/app.js" && ! ls -1 "$RELEASES_DIR/$VERSION/public"/*.js >/dev/null 2>&1; then
  echo "ERROR: slim release missing frontend JS bundle" >&2
  exit 1
fi
if [ ! -f "$RELEASES_DIR/$VERSION/dist/index.js" ]; then
  echo "ERROR: slim release missing dist/index.js" >&2
  exit 1
fi

ln -sfn "$RELEASES_DIR/$VERSION" "$BASE_DIR/current"

mkdir -p "$SHARED_DIR"
VERSIONS_FILE="$SHARED_DIR/versions.json"
export VERSIONS_FILE

if [ ! -f "$VERSIONS_FILE" ]; then
  printf "%s\n" '{ "current": "", "versions": [] }' > "$VERSIONS_FILE"
fi

python3 - <<'PY'
import json, os
from datetime import datetime
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
        "createdAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    })
data["versions"] = versions
with open(file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PY

if [ -x /srv/cssos/bin/cleanup-releases.sh ]; then
  KEEP="${KEEP:-3}" /srv/cssos/bin/cleanup-releases.sh
fi

systemctl restart cssOS

echo "== Slim deploy complete =="
echo "Current => $(readlink -f "$BASE_DIR/current")"
EOF
}

install_target() {
  local target="$1"
  local remote_path=""
  local ssh_cmd=(ssh)
  local base_dir="/srv/cssos"
  if [[ "$target" == "gzvm" ]]; then
    remote_path="/home/ubuntu/cssOS/bin/deploy-release.sh"
    ssh_cmd=(ssh -o RemoteCommand=none -T)
    base_dir="/home/ubuntu/cssOS"
  else
    remote_path="/srv/cssos/bin/deploy-release.sh"
  fi
  say "${target}: installing slim deploy-release.sh"
  build_remote_script "$base_dir" | sed "s|__BASE_DIR__|${base_dir}|g" | "${ssh_cmd[@]}" "$target" "sudo tee ${remote_path} >/dev/null && sudo chmod +x ${remote_path}"
  say "${target}: install complete"
}

case "${TARGET}" in
  api-vm)
    install_target api-vm
    ;;
  gzvm)
    install_target gzvm
    ;;
  all)
    install_target api-vm
    install_target gzvm
    ;;
  *)
    echo "usage: TARGET={api-vm|gzvm|all} $(basename "$0")" >&2
    exit 1
    ;;
esac
