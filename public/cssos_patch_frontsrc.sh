#!/usr/bin/env bash
set -euo pipefail

FRONT_SRC="/srv/cssos/releases/20260222_201002/public"
DEPLOY="/srv/cssos/bin/deploy-release.sh"

if [ ! -f "$FRONT_SRC/index.html" ]; then
  echo "ERROR: FRONT_SRC missing index.html: $FRONT_SRC" >&2
  exit 1
fi

sudo perl -0777 -i -pe '
  my $s = $_;
  my $src = $ENV{FRONT_SRC};

  # 删除旧的 Ensure frontend public 段（如果存在）
  $s =~ s/\n# === Ensure frontend public\/ exists in the release ===.*?# === End ensure frontend public\/ ===\n//s;

  my $inject = "\n# === Ensure frontend public/ exists in the release ===\n".
               "FRONT_SRC=\"$src\"\n".
               "mkdir -p \\\"\\$RELEASES_DIR/\\$VERSION/public\\\"\n".
               "rsync -a --delete \\\"\\$FRONT_SRC/\\\" \\\"\\$RELEASES_DIR/\\$VERSION/public/\\\"\n".
               "test -f \\\"\\$RELEASES_DIR/\\$VERSION/public/index.html\\\"\n".
               "# app.js may be bundled; require at least one js\n".
               "ls -1 \\\"\\$RELEASES_DIR/\\$VERSION/public\\\"/*.js >/dev/null 2>&1 || test -f \\\"\\$RELEASES_DIR/\\$VERSION/public/app.js\\\"\n".
               "# === End ensure frontend public/ ===\n";

  if ($s =~ /# Switch current symlink/) {
    $s =~ s/\n# Switch current symlink/\n$inject\n# Switch current symlink/;
  } else {
    $s .= "\n$inject\n";
  }

  $_ = $s;
' "$DEPLOY"

sudo /srv/cssos/bin/deploy-release.sh

curl -sI http://127.0.0.1/ | sed -n "1,15p"
readlink -f /srv/cssos/current
ls -lah /srv/cssos/current/public | sed -n "1,80p"
