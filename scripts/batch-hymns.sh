#!/usr/bin/env bash
# CSSOS_WAVE_1716 — 圣诗批量入队。把一堆 .mxl/.musicxml/.xml 丢进一个目录, 一条命令全部入队,
# 已在运行的 worker(并发 1 + nice 15)逐首忠实渲染 → 自动进大教堂画廊。
#
# 【在 api-vm 上运行】(它有数据库 + artifacts 目录 + 运行中的 worker)。
#
# 用法:
#   scp your-hymns/*.mxl api-vm:/srv/cssos/hymn-inbox/
#   ssh api-vm 'bash /srv/cssos/current/scripts/batch-hymns.sh /srv/cssos/hymn-inbox [--no-mv]'
#
#   --no-mv : 只渲染音频 + 逐字字幕(秒出, 先填满画廊); MV 之后再单独补。
#             默认渲染完整 MV(慢, 每首约 9 分钟, 靠出图)。
set -euo pipefail

IN_DIR="${1:-}"
RENDER_MV="true"
RENDER_COVER="false"
TRADITION="secular"
for arg in "${@:2}"; do
  case "$arg" in
    --no-mv) RENDER_MV="false" ;;
    --cover) RENDER_COVER="true" ;;   # 纯音频也出一张 2.39:1 影院封面(上卡 + og:image)
    --tradition=*) TRADITION="${arg#--tradition=}" ;;
  esac
done

if [ -z "$IN_DIR" ] || [ ! -d "$IN_DIR" ]; then
  echo "用法: bash batch-hymns.sh <输入目录> [--no-mv]" >&2
  exit 1
fi

DBU="$(sudo grep -E '^DATABASE_URL=' /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"')"
export PGCLIENTENCODING=UTF8
SVC_USER="$(ps -o user= -p "$(systemctl show cssOS -p MainPID --value)" | tr -d ' ')"
BATCH_ID="$(date +%Y%m%d-%H%M%S)"
OUT_ROOT="/srv/cssos/artifacts/scores/batch-${BATCH_ID}"
# 批量作品挂在一个固定的"圣诗批次"用户下(公开画廊按 status=done 列, 不做用户门禁)。
BATCH_USER="00000000-0000-0000-0000-0000000b0000"

sudo mkdir -p "$OUT_ROOT"
echo "== 批次 $BATCH_ID  ·  render_mv=$RENDER_MV  ·  cover=$RENDER_COVER  ·  tradition=$TRADITION  ·  输出 $OUT_ROOT =="

# XML 内容提取: .mxl 是 zip(解出内部 .musicxml); 其余直接用。
extract_xml() {   # $1=输入文件  $2=目标 .musicxml
  local f="$1" dst="$2"
  case "$f" in
    *.mxl)
      local tmp; tmp="$(mktemp -d)"
      unzip -o -q "$f" -d "$tmp"
      local score; score="$(find "$tmp" -type f \( -iname '*.musicxml' -o -iname '*.xml' \) ! -path '*META-INF*' | head -1)"
      [ -z "$score" ] && { rm -rf "$tmp"; return 1; }
      cp "$score" "$dst"; rm -rf "$tmp" ;;
    *) cp "$f" "$dst" ;;
  esac
  # 起码得像 MusicXML(含 <note> 或 <score)
  grep -qiE '<score-partwise|<score-timewise|<note' "$dst" || return 1
  return 0
}

# 标题: <work-title>/<movement-title> → 否则歌词首句(圣咏/圣诗常以首句命名) → 否则文件名。
title_of() {   # $1=.musicxml  $2=文件基名(用于识别"标题只是文件名")
  local t base="${2:-}"
  t="$(grep -oiE '<work-title>[^<]+</work-title>' "$1" | head -1 | sed -E 's/<[^>]+>//g' || true)"
  [ -z "$t" ] && t="$(grep -oiE '<movement-title>[^<]+</movement-title>' "$1" | head -1 | sed -E 's/<[^>]+>//g' || true)"
  # 若标题为空或就是文件名(如 Bach 导出的 "bwv269.mxl") → 用【解析器】取干净首句当标题。
  #   直接 grep <text> 会把 SATB 四声部/多段词交织成乱码; 解析器正确分离声部与段落。
  if [ -z "$t" ] || printf '%s' "$t" | grep -qiE "\.(mxl|xml|musicxml)$|^${base%.*}$"; then
    local inc
    inc="$(node -e 'try{const{parseMusicXml}=require("/srv/cssos/current/dist/musicxml");const fs=require("fs");const mx=parseMusicXml(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write((mx.verses[0]?.words||[]).slice(0,6).map(w=>w.word).join(" "))}catch(e){}' "$1" 2>/dev/null || true)"
    [ -n "$inc" ] && t="$inc"
  fi
  echo "$t"
}

sql_escape() { printf "%s" "$1" | sed "s/'/''/g"; }

n_ok=0; n_skip=0; i=0
shopt -s nullglob nocaseglob
for f in "$IN_DIR"/*.mxl "$IN_DIR"/*.musicxml "$IN_DIR"/*.xml; do
  [ -f "$f" ] || continue
  i=$((i+1))
  base="$(basename "$f")"
  slug="$(printf "%s" "$base" | tr -c 'A-Za-z0-9' '-' | sed 's/--*/-/g;s/^-//;s/-$//')"
  job_dir="$OUT_ROOT/$slug"
  sudo mkdir -p "$job_dir"
  xml_path="$job_dir/score.musicxml"

  if ! sudo bash -c "$(declare -f extract_xml); extract_xml '$f' '$xml_path'"; then
    echo "  ✗ 跳过(非有效 MusicXML): $base"; n_skip=$((n_skip+1)); continue
  fi
  title="$(title_of "$xml_path" "$base")"; [ -z "$title" ] && title="${base%.*}"

  sudo chown -R "$SVC_USER":"$SVC_USER" "$job_dir"
  jid="$(psql "$DBU" -Atc "INSERT INTO score_render_jobs
      (user_id, xml_path, out_dir, url_prefix, title, render_mv, render_cover, tradition)
      VALUES ('$BATCH_USER', '$(sql_escape "$xml_path")', '$(sql_escape "$job_dir")',
              '/artifacts/scores/batch-${BATCH_ID}/${slug}', '$(sql_escape "$title")',
              $RENDER_MV, $RENDER_COVER, '$(sql_escape "$TRADITION")')
      RETURNING job_id;")"
  echo "  ✓ 入队 [$i] $title  → ${jid:0:8}"
  n_ok=$((n_ok+1))
done

echo "== 完成: 入队 $n_ok 首, 跳过 $n_skip 首 =="
echo "   worker(并发1·nice15)会逐首渲染; 查看进度:"
echo "     watch -n5 \"psql \\\"\$DBU\\\" -Atc \\\"SELECT status, count(*) FROM score_render_jobs WHERE out_dir LIKE '%batch-${BATCH_ID}%' GROUP BY status\\\"\""
echo "   完成后自动出现在 圣诗画廊(Dock 🏛 / ?hymns=1)。"
