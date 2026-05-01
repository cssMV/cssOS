#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/day4_recollect_${DATE_TAG}.log"
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
RESULTS_PER_QUERY="${RESULTS_PER_QUERY:-30}"
YTDLP_BIN="${YTDLP_BIN:-$HOME/.local/bin/yt-dlp}"
FILTER_BIN="${FILTER_BIN:-python3 scripts/search_and_download_filtered.py}"

mkdir -p data/raw_char/char002
mkdir -p data/raw_char/char003

read -r -d '' CHAR002_QUERIES <<'EOF' || true
single man talking head interview close up
male interview close up single person neutral background
male monologue close up single actor
man speaking to camera close up steady frame
male close up interview one person
male close up monologue one person
人物特写 男 采访 单人
男演员 独白 特写 单人
对镜头说话 男性 单人 特写
男性 采访 特写 单人
EOF

read -r -d '' CHAR003_QUERIES <<'EOF' || true
single man turning head close up
male portrait head movement close up
man looking left right close up single person
cinematic male portrait close up single subject
single person head turn close up male
male reaction close up single person
男性 回头 特写 单人
人物 头部转动 特写 男 单人
电影感 男性 特写 单人
单人 男性 侧脸 转头 特写
EOF

download_query() {
  local char_id="$1"
  local query="$2"
  local archive_file="data/meta/day4_anchor_archive_${char_id}.txt"
  local output_dir="data/raw_char/${char_id}"
  local title_whitelist="$3"

  echo "=== ${char_id} :: ${query}" | tee -a "$LOG_FILE"

  $FILTER_BIN \
    --query "$query" \
    --pool-name "$char_id" \
    --output-dir "$output_dir" \
    --archive-file "$archive_file" \
    --log-file "$LOG_FILE" \
    --yt-dlp-bin "$YTDLP_BIN" \
    --format-selector "$FORMAT_SELECTOR" \
    --results "$RESULTS_PER_QUERY" \
    --search-budget $((RESULTS_PER_QUERY * 6)) \
    --min-duration 8 \
    --max-duration 240 \
    --title-blacklist-regex "$TITLE_BLACKLIST_REGEX" \
    --title-whitelist-regex "$title_whitelist" \
    --channel-blacklist-regex "$CHANNEL_BLACKLIST_REGEX" \
    >> "$LOG_FILE" 2>&1 || true
}

run_group() {
  local char_id="$1"
  local queries="$2"
  local title_whitelist="$3"
  while IFS= read -r query; do
    [[ -z "$query" ]] && continue
    download_query "$char_id" "$query" "$title_whitelist"
  done <<< "$queries"
}

run_group "char002" "$CHAR002_QUERIES" "$TITLE_WHITELIST_CHAR002"
run_group "char003" "$CHAR003_QUERIES" "$TITLE_WHITELIST_CHAR003"

echo "Done. Anchor recollect pools updated in data/raw_char/char002 and data/raw_char/char003"
echo "Log file: $LOG_FILE"
TITLE_BLACKLIST_REGEX='(?i)(subtitle|subtitles|caption|captions|lyrics|karaoke|reaction|tiktok|shorts|podcast|vlog|compilation|edit|meme|prank|tutorial|lesson|how to|中字|双语|字幕|reaction cam|behind the scenes|bts|news|bbc|tvbs|ktla|interview with|podcast clip|scene pack|trailer|teaser|explained|gameplay|攻略|手游|mix|混剪|variety|花絮|live|直播|review)'
CHANNEL_BLACKLIST_REGEX='(?i)(news|tvbs|bbc|ktla|podcast|shorts|gaming|movieclips|explained|studentscoming|superband|同學來了|cheese trap)'
TITLE_WHITELIST_CHAR002='(?i)(man|male|talking|interview|monologue|close up|close-up|portrait|single|单人|特写|近景|独白|采访)'
TITLE_WHITELIST_CHAR003='(?i)(man|male|portrait|head|close up|close-up|cinematic|single|turning|reaction|单人|特写|回头|转头|电影感)'
