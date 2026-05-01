#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/raw
mkdir -p data/meta
mkdir -p logs

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/download_${DATE_TAG}.log"

RESULTS_PER_QUERY=30
FORMAT_SELECTOR='bv*[height<=720][ext=mp4]/b[height<=720][ext=mp4]/b[ext=mp4]'
OUTPUT_TEMPLATE='data/raw/%(title).120s__[%(id)s].%(ext)s'

read -r -d '' EN_QUERIES <<'EOF' || true
person walking close up
woman talking interview close up
man face talking slow motion
actor monologue close up
cinematic portrait video
person turning head close up
woman side face talking
man close up emotional talking
person sitting talking camera
woman walking medium shot
man walking cinematic shot
female lead close up dialogue
male lead close up dialogue
person looking into camera close up
actor profile face close up
woman natural light portrait video
man portrait cinematic close up
person standing still close up
person facial expression close up
person reaction close up
two people talking close up
woman walking toward camera
man walking toward camera
person talking head interview
cinematic face close up
human face speaking close up
slow motion face portrait
person turning around close up
person entering frame close up
person leaving frame close up
character introduction close up
EOF

read -r -d '' ZH_QUERIES <<'EOF' || true
人物特写 采访
走路 人物 视频
演员 独白 特写
人物 近景 说话
人物 侧脸 特写
女演员 特写 说话
男演员 特写 说话
人物 回头 特写
人物 转头 特写
人物 面部表情 特写
人物 对镜头说话
人物 半身 特写
人物 慢动作 特写
电影感 人物特写
人物 正脸 特写
人物 情绪 特写
两人 对话 特写
人物 走向镜头
人物 进入画面
人物 离开画面
角色 出场 特写
女主 特写 对白
男主 特写 对白
EOF

download_query() {
  local query="$1"
  echo "=== QUERY: ${query}" | tee -a "$LOG_FILE"

  yt-dlp \
    --no-playlist \
    --ignore-errors \
    --continue \
    --no-overwrites \
    --match-filter "duration > 10 & duration < 300" \
    --download-archive data/meta/archive.txt \
    -f "$FORMAT_SELECTOR" \
    "ytsearch${RESULTS_PER_QUERY}:${query}" \
    -o "$OUTPUT_TEMPLATE" \
    >> "$LOG_FILE" 2>&1 || true
}

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "$query"
done <<< "$EN_QUERIES"

while IFS= read -r query; do
  [[ -z "$query" ]] && continue
  download_query "$query"
done <<< "$ZH_QUERIES"

echo "Done. Raw videos are in data/raw"
echo "Log file: $LOG_FILE"
