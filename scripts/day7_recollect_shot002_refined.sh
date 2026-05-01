#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/day7_recollect_shot002_refined_${DATE_TAG}.log"
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
RESULTS_PER_QUERY="${RESULTS_PER_QUERY:-10}"
YTDLP_BIN="${YTDLP_BIN:-$HOME/.local/bin/yt-dlp}"
FILTER_BIN="${FILTER_BIN:-python3 scripts/search_and_download_filtered.py}"

OUTPUT_DIR="data/raw_char/char002_shot002_refined"
ARCHIVE_FILE="data/meta/day7_shot002_refined_archive_char002.txt"

mkdir -p "$OUTPUT_DIR"

read -r -d '' QUERIES <<'EOF' || true
male actor monologue close up black background
single male confession monologue close up dark room
male dramatic monologue close up studio black background
single man whispered monologue close up low light
male introspective close up monologue black backdrop
男性 独白 特写 黑背景 单人
男演员 独白 特写 黑色 背景
人物 独白 男性 低光 特写 单人
EOF

TITLE_BLACKLIST_REGEX='(?i)(female|actress|woman|emma watson|laura dern|marriage story|subtitle|subtitles|caption|captions|lyrics|karaoke|reaction|tiktok|shorts|podcast|vlog|compilation|edit|meme|prank|tutorial|lesson|how to|中字|双语|字幕|reaction cam|behind the scenes|bts|news|bbc|tvbs|ktla|interview with|podcast clip|scene pack|trailer|teaser|explained|gameplay|攻略|手游|mix|混剪|variety|花絮|live|直播|review|movieclips|scene)'
CHANNEL_BLACKLIST_REGEX='(?i)(news|tvbs|bbc|ktla|podcast|shorts|gaming|movieclips|explained|studentscoming|superband|同學來了|cheese trap)'
TITLE_WHITELIST_REGEX='(?i)((male|man|男|男性).*(monologue|close up|close-up|portrait|dramatic|confession|introspective|独白|特写|近景))|((monologue|独白).*(black|dark|black background|黑背景|低光))'

download_query() {
  local query="$1"
  echo "=== shot002_refined :: ${query}" | tee -a "$LOG_FILE"

  $FILTER_BIN \
    --query "$query" \
    --pool-name "shot002_refined" \
    --output-dir "$OUTPUT_DIR" \
    --archive-file "$ARCHIVE_FILE" \
    --log-file "$LOG_FILE" \
    --yt-dlp-bin "$YTDLP_BIN" \
    --format-selector "$FORMAT_SELECTOR" \
    --results "$RESULTS_PER_QUERY" \
    --search-budget $((RESULTS_PER_QUERY * 8)) \
    --min-duration 6 \
    --max-duration 75 \
    --title-blacklist-regex "$TITLE_BLACKLIST_REGEX" \
    --title-whitelist-regex "$TITLE_WHITELIST_REGEX" \
    --channel-blacklist-regex "$CHANNEL_BLACKLIST_REGEX" \
    >> "$LOG_FILE" 2>&1 || true
}

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "$query"
done <<< "$QUERIES"

echo "Done. Refined shot002 pool updated in ${OUTPUT_DIR}"
echo "Log file: ${LOG_FILE}"
