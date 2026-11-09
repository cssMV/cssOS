#!/bin/bash
# W2279 批次 runner —— 手写京典词, 串行, 一首一首。
#
# Jing 2026-11-08:「那 25 首要不要请照 Shakespeare 这个样子一首一首手写。
#                   被拦的 10 首只能手写, 请排进去。」
# Jing 既有常驻:「以后先不要几路并发了, 我们不急, 要稳, 准, 狠!一个一个来也不错。」
#
# 与 w2277-batch-mother-tongue.sh 的区别: 清单每行三列 —— 作品 / 语言 / 手写词文件,
# 因为这一批【每首的语言和词都不一样】(en 31 + hi 2 + el 2), 不能像上一批那样全批一个 lang。
#
# 用法: bash w2279-batch-handwritten.sh <manifest.tsv>
#   manifest 每行: <workId>\t<lang>\t<手写词文件绝对路径>
#
# 断点续跑: 已有该语言 ready 轨的直接跳过 —— 重跑这个脚本是安全的。
# 一首失败【不停整批】, 但记下来并在末尾汇总。
#
# ⚠ 两个坑, 上一批各栽过一次:
#   1 `while read` 会【静默吞掉文件最后一行】(末尾无换行时)。补 `echo` 兜住,
#     并且末尾必须打印「三类加起来 ≠ 清单」的自查 —— 汇总不自查就是假通过。
#   2 手写词路径必须在【跑之前】全部存在。缺一个文件要在第一首之前就报出来,
#     不能跑到第 30 首才发现 —— 那时前 29 首的钱已经花了。
set -u
set -a; . /etc/cssos.env 2>/dev/null || true; set +a
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAN="${1:?用法: $0 <manifest.tsv>}"
# 日志按 manifest 命名 —— 两批同名会把上一批的日志清空(脚本开头 `: > $LOG`),
# 失败清单也会混成一份, 事后分不清是哪一批的。
TAG="$(basename "${1%.tsv}")"
LOG=/tmp/w2279-$TAG.log
FAILED=/tmp/w2279-$TAG.failed

total=$(grep -c . "$MAN")
# ── 先把整份清单验一遍, 再花第一分钱 ────────────────────────────────
bad=0
while IFS=$'\t' read -r wid lang lyr; do
  [ -z "${wid:-}" ] && continue
  if [ -z "${lang:-}" ] || [ -z "${lyr:-}" ]; then echo "清单格式错: $wid"; bad=1; continue; fi
  [ -s "$lyr" ] || { echo "缺手写词文件: $wid $lang $lyr"; bad=1; }
done < <(cat "$MAN"; echo)
[ "$bad" = 0 ] || { echo "FAIL: 清单有问题, 一首都不跑 —— 跑到一半才发现等于白花前面的钱"; exit 1; }
echo "清单自检通过: $total 首, 手写词文件全部就位"

: > "$LOG"
n=0; okc=0; skip=0; failc=0
echo "批次开始 $(date -u +%FT%TZ) —— $total 首(手写京典词)" | tee -a "$LOG"
while IFS=$'\t' read -r wid lang lyr; do
  [ -z "${wid:-}" ] && continue
  n=$((n+1))
  st=$(psql "$DATABASE_URL" -X -q -t -A -c "select coalesce(status,'') from work_language_tracks where work_id='$wid'::uuid and lang='$lang' and voice='auto'" 2>/dev/null)
  if [ "$st" = "ready" ]; then
    echo "[$n/$total] ${wid:0:8} 已有 ready 的 $lang 轨 —— 跳过(断点续跑)" | tee -a "$LOG"
    skip=$((skip+1)); continue
  fi
  echo "[$n/$total] ${wid:0:8} $lang ← $(basename "$lyr")  开始 $(date -u +%T)" | tee -a "$LOG"
  if bash "$HERE/w2277-add-mother-tongue-track.sh" "$wid" "$lang" --lyrics-file "$lyr" >>"$LOG" 2>&1; then
    okc=$((okc+1)); echo "[$n/$total] ${wid:0:8} OK $(date -u +%T)" | tee -a "$LOG"
  else
    failc=$((failc+1)); echo "[$n/$total] ${wid:0:8} FAILED $(date -u +%T) —— 不停整批, 末尾汇总" | tee -a "$LOG"
    printf '%s\t%s\t%s\n' "$wid" "$lang" "$lyr" >> "$FAILED"
  fi
done < <(cat "$MAN"; echo)
echo "批次结束 $(date -u +%FT%TZ)" | tee -a "$LOG"
echo "汇总: 清单 $total · 做成 $okc · 跳过 $skip · 失败 $failc" | tee -a "$LOG"
[ "$((okc+skip+failc))" -eq "$total" ] \
  || echo "⚠ 三类加起来 $((okc+skip+failc)) ≠ 清单 $total —— 有漏判, 别信上面的数" | tee -a "$LOG"
