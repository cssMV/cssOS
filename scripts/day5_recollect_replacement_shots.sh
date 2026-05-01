#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/day5_recollect_replacement_shots_${DATE_TAG}.log"
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
RESULTS_PER_QUERY="${RESULTS_PER_QUERY:-24}"
YTDLP_BIN="${YTDLP_BIN:-$HOME/.local/bin/yt-dlp}"
FILTER_BIN="${FILTER_BIN:-python3 scripts/search_and_download_filtered.py}"
OUTPUT_DIR="data/raw_char/char002_replacements"
ARCHIVE_FILE="data/meta/day5_replacement_archive_char002.txt"

# Bias hard toward single-subject male close-ups that can replace weak probe shots.
read -r -d '' QUERIES <<'EOF' || true
single man close up black background monologue
male talking head close up dark background
male interview close up wood background single person
single man dramatic close up black backdrop
male portrait close up cinematic dark background
male monologue close up studio black background
single male close up interrogation room
single man close up warm wood panel background
单人 男性 特写 黑色 背景
男性 独白 特写 黑背景 单人
男性 采访 特写 木质 背景 单人
电影感 男性 单人 特写 黑背景
EOF

TITLE_BLACKLIST_REGEX='(?i)(subtitle|subtitles|caption|captions|lyrics|karaoke|reaction|tiktok|shorts|podcast|vlog|compilation|edit|meme|prank|tutorial|lesson|how to|中字|双语|字幕|reaction cam|behind the scenes|bts|news|bbc|tvbs|ktla|interview with|podcast clip|scene pack|trailer|teaser|explained|gameplay|攻略|手游|mix|混剪|variety|花絮|live|直播|review)'
CHANNEL_BLACKLIST_REGEX='(?i)(news|tvbs|bbc|ktla|podcast|shorts|gaming|movieclips|explained|studentscoming|superband|同學來了|cheese trap)'
TITLE_WHITELIST_REGEX='(?i)(man|male|monologue|close up|close-up|portrait|dark|interrogation|cinematic|特写|近景|独白|人物)'

mkdir -p "$OUTPUT_DIR"

download_query() {
  local query="$1"

  echo "=== char002_replacements :: ${query}" | tee -a "$LOG_FILE"

  $FILTER_BIN \
    --query "$query" \
    --pool-name "char002_replacements" \
    --output-dir "$OUTPUT_DIR" \
    --archive-file "$ARCHIVE_FILE" \
    --log-file "$LOG_FILE" \
    --yt-dlp-bin "$YTDLP_BIN" \
    --format-selector "$FORMAT_SELECTOR" \
    --results "$RESULTS_PER_QUERY" \
    --search-budget $((RESULTS_PER_QUERY * 6)) \
    --min-duration 6 \
    --max-duration 120 \
    --title-blacklist-regex "$TITLE_BLACKLIST_REGEX" \
    --title-whitelist-regex "$TITLE_WHITELIST_REGEX" \
    --channel-blacklist-regex "$CHANNEL_BLACKLIST_REGEX" \
    >> "$LOG_FILE" 2>&1 || true
}

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "$query"
done <<< "$QUERIES"

echo "Done. Replacement-shot pool updated in ${OUTPUT_DIR}"
echo "Log file: ${LOG_FILE}"
