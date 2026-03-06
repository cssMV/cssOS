#!/usr/bin/env bash
set -euo pipefail

DEPLOY="/srv/cssos/bin/deploy-release.sh"
FALLBACK_FRONT_SRC="/srv/cssos/releases/20260222_201002/public"

sudo test -f "$DEPLOY"
sudo test -f "$FALLBACK_FRONT_SRC/index.html"

sudo perl -0777 -i -pe '
  my $s = $_;

  # Remove existing ensure-frontend block if present
  $s =~ s/\n# === Ensure frontend public\/ exists in the release ===.*?# === End ensure frontend public\/ ===\n//s;

  my $inject = q{

# === Ensure frontend public/ exists in the release ===
# You can override FRONT_SRC when repo does not contain built frontend assets.
# Example: FRONT_SRC=/srv/cssos/releases/<known_good>/public sudo /srv/cssos/bin/deploy-release.sh
FRONT_SRC="${FRONT_SRC:-}"

if [ -z "$FRONT_SRC" ]; then
  if [ -d "$REPO_DIR/public" ] && [ -f "$REPO_DIR/public/index.html" ]; then
    FRONT_SRC="$REPO_DIR/public"
  elif [ -d "$REPO_DIR/registry/public" ] && [ -f "$REPO_DIR/registry/public/index.html" ]; then
    FRONT_SRC="$REPO_DIR/registry/public"
  elif [ -d "$REPO_DIR/dist/public" ] && [ -f "$REPO_DIR/dist/public/index.html" ]; then
    FRONT_SRC="$REPO_DIR/dist/public"
  fi
fi

if [ -z "$FRONT_SRC" ]; then
  echo "ERROR: FRONT_SRC not set and repo has no frontend public/ assets (need index.html + js bundle)" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR/$VERSION/public"
rsync -a --delete "$FRONT_SRC/" "$RELEASES_DIR/$VERSION/public/"

test -f "$RELEASES_DIR/$VERSION/public/index.html"
# require at least one js
ls -1 "$RELEASES_DIR/$VERSION/public"/*.js >/dev/null 2>&1 || test -f "$RELEASES_DIR/$VERSION/public/app.js"
# === End ensure frontend public/ ===

};

  if ($s =~ /# Switch current symlink/) {
    $s =~ s/\n# Switch current symlink/\n$inject\n# Switch current symlink/;
  } else {
    $s .= "\n$inject\n";
  }

  $_ = $s;
' "$DEPLOY"

echo "== Patched deploy script. Now deploy using fallback FRONT_SRC =="

FRONT_SRC="$FALLBACK_FRONT_SRC" sudo /srv/cssos/bin/deploy-release.sh

curl -sI http://127.0.0.1/ | sed -n "1,15p"
