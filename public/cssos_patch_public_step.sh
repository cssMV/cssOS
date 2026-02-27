#!/usr/bin/env bash
set -euo pipefail

DEPLOY="/srv/cssos/bin/deploy-release.sh"

sudo test -f "$DEPLOY"

sudo perl -0777 -i -pe '
  my $s = $_;
  my $inject = q{

# === Ensure frontend public/ exists in the release ===
FRONT_SRC=""
if [ -d "$REPO_DIR/public" ] && [ -f "$REPO_DIR/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/public"
elif [ -d "$REPO_DIR/registry/public" ] && [ -f "$REPO_DIR/registry/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/registry/public"
elif [ -d "$REPO_DIR/dist/public" ] && [ -f "$REPO_DIR/dist/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/dist/public"
elif [ -d "$REPO_DIR/build/public" ] && [ -f "$REPO_DIR/build/public/index.html" ]; then
  FRONT_SRC="$REPO_DIR/build/public"
fi

if [ -z "$FRONT_SRC" ]; then
  echo "ERROR: frontend public/ not found in repo after build (need index.html + app.js)" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR/$VERSION/public"
rsync -a --delete "$FRONT_SRC/" "$RELEASES_DIR/$VERSION/public/"

test -f "$RELEASES_DIR/$VERSION/public/index.html"
test -f "$RELEASES_DIR/$VERSION/public/app.js"
# === End ensure frontend public/ ===

};

  if ($s =~ /# Switch current symlink/) {
    $s =~ s/\n# Switch current symlink/\n$inject\n# Switch current symlink/;
  } else {
    $s .= "\n$inject\n";
  }

  $_ = $s;
' "$DEPLOY"

echo "== deploy script patched =="
sudo grep -n "Ensure frontend public" -n "$DEPLOY" | head -n 20 || true
