#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/day6_recollect_shot002_shot008_${DATE_TAG}.log"
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
RESULTS_PER_QUERY="${RESULTS_PER_QUERY:-18}"
YTDLP_BIN="${YTDLP_BIN:-$HOME/.local/bin/yt-dlp}"
FILTER_BIN="${FILTER_BIN:-python3 scripts/search_and_download_filtered.py}"

SHOT002_DIR="data/raw_char/char002_shot002_replacements"
SHOT008_DIR="data/raw_char/char002_shot008_replacements"
SHOT002_ARCHIVE="data/meta/day6_shot002_archive_char002.txt"
SHOT008_ARCHIVE="data/meta/day6_shot008_archive_char002.txt"

# Keep these pools isolated so later probe_v4 replacement work stays clean.
mkdir -p "$SHOT002_DIR"
mkdir -p "$SHOT008_DIR"

read -r -d '' SHOT002_QUERIES <<'EOF' || true
single man memory monologue close up dark room
male close up introspective monologue single person
male dramatic monologue close up dark background
single man speaking softly close up cinematic room
male memory loss monologue close up one person
单人 男性 独白 特写 暗色 室内
男性 近景 独白 电影感 单人
人物 特写 男性 低光 室内 独白
EOF

read -r -d '' SHOT008_QUERIES <<'EOF' || true
single man final close up dark background no subtitles
male emotional close up black background single person
male quiet hesitation close up dark room
single man contemplative close up no text no logo
male portrait close up low light single subject
单人 男性 终场 特写 黑背景 无字幕
男性 情绪 特写 低光 单人 无字幕
人物 近景 男性 黑背景 收尾 镜头
EOF

TITLE_BLACKLIST_REGEX='(?i)(subtitle|subtitles|caption|captions|lyrics|karaoke|reaction|tiktok|shorts|podcast|vlog|compilation|edit|meme|prank|tutorial|lesson|how to|中字|双语|字幕|reaction cam|behind the scenes|bts|news|bbc|tvbs|ktla|interview with|podcast clip|scene pack|trailer|teaser|explained|gameplay|攻略|手游|mix|混剪|variety|花絮|live|直播|recap|ending explained|review|news 中文)'
CHANNEL_BLACKLIST_REGEX='(?i)(news|tvbs|bbc|ktla|podcast|shorts|gaming|movieclips|explained|studentscoming|superband|同學來了|cheese trap)'
TITLE_WHITELIST_SHOT002='(?i)(monologue|close up|close-up|portrait|dramatic|cinematic|独白|特写|近景|人物)'
TITLE_WHITELIST_SHOT008='(?i)(close up|close-up|portrait|dark|final|quiet|cinematic|emotional|特写|近景|低光|黑背景)'

download_query() {
  local pool_name="$1"
  local query="$2"
  local archive_file="$3"
  local output_dir="$4"
  local title_whitelist="$5"

  echo "=== ${pool_name} :: ${query}" | tee -a "$LOG_FILE"

  $FILTER_BIN \
    --query "$query" \
    --pool-name "$pool_name" \
    --output-dir "$output_dir" \
    --archive-file "$archive_file" \
    --log-file "$LOG_FILE" \
    --yt-dlp-bin "$YTDLP_BIN" \
    --format-selector "$FORMAT_SELECTOR" \
    --results "$RESULTS_PER_QUERY" \
    --search-budget $((RESULTS_PER_QUERY * 6)) \
    --min-duration 6 \
    --max-duration 90 \
    --title-blacklist-regex "$TITLE_BLACKLIST_REGEX" \
    --title-whitelist-regex "$title_whitelist" \
    --channel-blacklist-regex "$CHANNEL_BLACKLIST_REGEX" \
    >> "$LOG_FILE" 2>&1 || true
}

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "shot002" "$query" "$SHOT002_ARCHIVE" "$SHOT002_DIR" "$TITLE_WHITELIST_SHOT002"
done <<< "$SHOT002_QUERIES"

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "shot008" "$query" "$SHOT008_ARCHIVE" "$SHOT008_DIR" "$TITLE_WHITELIST_SHOT008"
done <<< "$SHOT008_QUERIES"

echo "Done. Targeted pools updated in ${SHOT002_DIR} and ${SHOT008_DIR}"
echo "Log file: ${LOG_FILE}"
