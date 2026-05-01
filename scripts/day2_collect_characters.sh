#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/day2_collect_${DATE_TAG}.log"
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
RESULTS_PER_QUERY="${RESULTS_PER_QUERY:-40}"

mkdir -p data/raw_char/char001
mkdir -p data/raw_char/char002
mkdir -p data/raw_char/char003

read -r -d '' CHAR001_QUERIES <<'EOF' || true
woman talking interview close up
female lead close up dialogue
woman side face talking
woman natural light portrait video
女演员 特写 说话
女主 特写 对白
人物 情绪 特写
EOF

read -r -d '' CHAR002_QUERIES <<'EOF' || true
man close up emotional talking
actor monologue close up
male lead close up dialogue
person talking head interview
男演员 特写 说话
演员 独白 特写
人物 对镜头说话
EOF

read -r -d '' CHAR003_QUERIES <<'EOF' || true
cinematic portrait video
person turning head close up
character introduction close up
person reaction close up
电影感 人物特写
角色 出场 特写
人物 回头 特写
EOF

download_query() {
  local char_id="$1"
  local query="$2"
  local archive_file="data/meta/archive_${char_id}.txt"
  local output_template="data/raw_char/${char_id}/%(title).120s__[%(id)s].%(ext)s"

  echo "=== ${char_id} :: ${query}" | tee -a "$LOG_FILE"

  "$HOME/.local/bin/yt-dlp" \
    --no-playlist \
    --ignore-errors \
    --continue \
    --no-overwrites \
    --match-filter "duration > 10 & duration < 300" \
    --download-archive "$archive_file" \
    -f "$FORMAT_SELECTOR" \
    "ytsearch${RESULTS_PER_QUERY}:${query}" \
    -o "$output_template" \
    >> "$LOG_FILE" 2>&1 || true
}

run_group() {
  local char_id="$1"
  local queries="$2"
  while IFS= read -r query; do
    [[ -z "$query" ]] && continue
    download_query "$char_id" "$query"
  done <<< "$queries"
}

run_group "char001" "$CHAR001_QUERIES"
run_group "char002" "$CHAR002_QUERIES"
run_group "char003" "$CHAR003_QUERIES"

echo "Done. Character raw pools are in data/raw_char/char001|002|003"
echo "Log file: $LOG_FILE"
