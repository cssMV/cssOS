#!/usr/bin/env bash
set -euo pipefail

sudo perl -0777 -i -pe '
  my $ins = q{

# --- Ensure frontend public/ exists in release ---
FRONT_SRC=""

if [ -d "$REPO_DIR/public" ] && [ -f "$REPO_DIR/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/public"
elif [ -d "$REPO_DIR/registry/public" ] && [ -f "$REPO_DIR/registry/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/registry/public"
elif [ -d "$REPO_DIR/dist/public" ] && [ -f "$REPO_DIR/dist/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/dist/public"
fi

if [ -z "$FRONT_SRC" ]; then
  echo "ERROR: frontend public/ not found after build" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR/$VERSION/public"
rsync -a --delete "$FRONT_SRC/" "$RELEASES_DIR/$VERSION/public/"
};

  s|(rsync[\s\S]*?"\$RELEASES_DIR/\$VERSION/"\n)|$1$ins|s;
' /srv/cssos/bin/deploy-release.sh

echo "Patched deploy-release.sh to ensure frontend public/ exists"
