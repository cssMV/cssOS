#!/usr/bin/env bash
set -euo pipefail

REPO="${CSSOS_REPO:-/home/jing/cssOS/repo}"
SHARED="${CSSOS_SHARED:-/srv/cssos/shared/assets}"
WEB_USER="${CSSOS_WEB_USER:-www-data}"
DEV_USER="${CSSOS_DEV_USER:-jing}"

PUB_FONTS="$REPO/public/fonts"
PUB_EXAMPLES="$REPO/public/examples"
SHARED_FONTS="$SHARED/fonts"
SHARED_EXAMPLES="$SHARED/examples"

mkdir -p "$PUB_FONTS" "$PUB_EXAMPLES" "$SHARED_FONTS" "$SHARED_EXAMPLES"

is_font_file() {
  local f="${1,,}"
  [[ "$f" =~ \.(ttf|otf|woff|woff2)$ ]]
}

is_media_file() {
  local f="${1,,}"
  [[ "$f" =~ \.(mp4|mov|m4v|webm|wav|mp3|mkv)$ ]]
}

ensure_link() {
  local src="$1"
  local dst="$2"
  if [[ -L "$dst" ]]; then
    local cur
    cur="$(readlink "$dst" || true)"
    [[ "$cur" == "$src" ]] && return 0
  elif [[ -e "$dst" ]]; then
    rm -f "$dst"
  fi
  ln -s "$src" "$dst"
}

move_into_shared() {
  local from_dir="$1"
  local to_dir="$2"
  local mode="$3"
  while IFS= read -r -d '' f; do
    local base dst
    base="$(basename "$f")"
    dst="$to_dir/$base"

    if [[ "$mode" == "fonts" ]]; then
      is_font_file "$base" || continue
    else
      is_media_file "$base" || continue
    fi

    if [[ -e "$dst" ]]; then
      if cmp -s "$f" "$dst"; then
        rm -f "$f"
      else
        mv -f "$f" "$dst"
      fi
    else
      mv -f "$f" "$dst"
    fi
  done < <(find "$from_dir" -maxdepth 1 -type f -print0)
}

sync_links_from_shared() {
  local shared_dir="$1"
  local pub_dir="$2"
  local mode="$3"

  find "$pub_dir" -maxdepth 1 -xtype l -delete || true

  while IFS= read -r -d '' src; do
    local base
    base="$(basename "$src")"
    if [[ "$mode" == "fonts" ]]; then
      is_font_file "$base" || continue
    else
      is_media_file "$base" || continue
    fi
    ensure_link "$src" "$pub_dir/$base"
  done < <(find "$shared_dir" -maxdepth 1 -type f -print0)
}

write_manifest_if_changed() {
  local manifest="$PUB_EXAMPLES/manifest.json"
  local tmp
  tmp="$(mktemp)"

  node - <<'NODE' > "$tmp"
const fs = require('fs');
const path = process.env.PUB_EXAMPLES;
const list = fs.readdirSync(path)
  .filter((n) => /\.(mp4|mov|m4v|webm)$/i.test(n))
  .sort((a, b) => a.localeCompare(b));
process.stdout.write(JSON.stringify(list));
NODE

  if [[ ! -f "$manifest" ]] || ! cmp -s "$tmp" "$manifest"; then
    mv -f "$tmp" "$manifest"
  else
    rm -f "$tmp"
  fi
}

export PUB_EXAMPLES
move_into_shared "$PUB_FONTS" "$SHARED_FONTS" "fonts"
move_into_shared "$PUB_EXAMPLES" "$SHARED_EXAMPLES" "media"
sync_links_from_shared "$SHARED_FONTS" "$PUB_FONTS" "fonts"
sync_links_from_shared "$SHARED_EXAMPLES" "$PUB_EXAMPLES" "media"
write_manifest_if_changed

chown -h "$WEB_USER:$WEB_USER" "$SHARED_FONTS"/* 2>/dev/null || true
chown -h "$WEB_USER:$WEB_USER" "$SHARED_EXAMPLES"/* 2>/dev/null || true
chown -h "$DEV_USER:$DEV_USER" "$PUB_FONTS"/* "$PUB_EXAMPLES"/* 2>/dev/null || true
chown "$DEV_USER:$DEV_USER" "$PUB_EXAMPLES/manifest.json" 2>/dev/null || true
