#!/usr/bin/env bash
set -euo pipefail

FRONT_SRC="/srv/cssos/releases/20260222_201002/public"

sudo tee /srv/cssos/bin/deploy-release.sh >/dev/null <<EOF
#!/usr/bin/env bash
set -euo pipefail

BASE_DIR=/srv/cssos
REPO_DIR=\$BASE_DIR/repo
RELEASES_DIR=\$BASE_DIR/releases
SHARED_DIR=\$BASE_DIR/shared
VERSION=\$(date +%Y%m%d_%H%M%S)

export VERSION

echo "== Deploying version: \$VERSION =="

cd "\$REPO_DIR"

# Ensure dependencies + build
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

# Create release
mkdir -p "\$RELEASES_DIR/\$VERSION"

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  "\$REPO_DIR/" "\$RELEASES_DIR/\$VERSION/"

# Install production deps in release
cd "\$RELEASES_DIR/\$VERSION"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
cd "\$REPO_DIR"

# === Ensure frontend public/ exists in the release ===
FRONT_SRC="$FRONT_SRC"
mkdir -p "\$RELEASES_DIR/\$VERSION/public"
rsync -a --delete "\$FRONT_SRC/" "\$RELEASES_DIR/\$VERSION/public/"

# Update current symlink
ln -sfn "\$RELEASES_DIR/\$VERSION" "\$BASE_DIR/current"

# Update versions.json
mkdir -p "\$SHARED_DIR"
VERSIONS_FILE="\$SHARED_DIR/versions.json"
export VERSIONS_FILE

if [ ! -f "\$VERSIONS_FILE" ]; then
  printf "%s\n" "{ \\\"current\\\": \\\"\\\", \\\"versions\\\": [] }" > "\$VERSIONS_FILE"
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
mkdir -p "\$SHARED_DIR/assets/fonts" "\$SHARED_DIR/assets/examples"

if [ -d "\$SHARED_DIR/assets/examples/examples" ]; then
  rsync -a "\$SHARED_DIR/assets/examples/examples/" "\$SHARED_DIR/assets/examples/"
  rm -rf "\$SHARED_DIR/assets/examples/examples"
fi

if [ -d "\$RELEASES_DIR/\$VERSION/public" ]; then
  rm -rf "\$RELEASES_DIR/\$VERSION/public/fonts"
  ln -sfn "\$SHARED_DIR/assets/fonts" "\$RELEASES_DIR/\$VERSION/public/fonts"

  mkdir -p "\$RELEASES_DIR/\$VERSION/public/assets"
  rm -rf "\$RELEASES_DIR/\$VERSION/public/assets/examples"
  ln -sfn "\$SHARED_DIR/assets/examples" "\$RELEASES_DIR/\$VERSION/public/assets/examples"
fi

# Cleanup old releases (keep last 10 by default)
KEEP=\${KEEP:-10} /srv/cssos/bin/cleanup-releases.sh

echo "== Restarting service =="
systemctl restart cssOS

echo "== Deploy complete =="
echo "Current => \$(readlink -f \$BASE_DIR/current)"
EOF

sudo chmod +x /srv/cssos/bin/deploy-release.sh

sudo /srv/cssos/bin/deploy-release.sh

curl -sI http://127.0.0.1/ | sed -n "1,12p"
