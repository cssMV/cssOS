#!/usr/bin/env bash
# 《时间帝国》确定性道具渲染 —— HTML → PNG, 逐像素可复现。
# 尺寸从每个 HTML 的 html,body 宽高读出, 不写死。
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "找不到 Chrome"; exit 1; }
D="$(cd "$(dirname "$0")/../docs/timeempire-plates/props" && pwd)"
for f in "$D"/prop-*.html "$D"/M4-1-the-register.html; do
  [ -e "$f" ] || continue
  n="$(basename "$f" .html)"
  W=$(grep -oE 'width:[0-9]+px' "$f" | head -1 | grep -oE '[0-9]+')
  H=$(grep -oE 'height:[0-9]+px' "$f" | head -1 | grep -oE '[0-9]+')
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="${W},${H}" --screenshot="$D/$n.png" "file://$f" >/dev/null 2>&1
  printf '  %-38s %sx%s  %s\n' "$n" "$W" "$H" "$(shasum -a 256 "$D/$n.png" | cut -c1-12)"
done
