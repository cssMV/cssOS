#!/bin/bash
# W2277 批次 runner —— 串行, 一首一首。
# Jing:「以后先不要几路并发了，我们不急，要稳，准，狠！一个一个来也不错。」
#
# 断点续跑: 已经有这个语言且 status=ready 的作品直接跳过, 所以重跑这个脚本是安全的。
# 一首失败【不停整批】(23 首不该为 1 首停下), 但会记下来并在末尾汇总 —— 失败要说出来。
set -u
set -a; . /etc/cssos.env 2>/dev/null || true; set +a
HERE=/tmp/w2277
LIST="$1"; LANG_CODE="$2"
LOG=/tmp/w2277-batch-$LANG_CODE.log
: > "$LOG"
total=$(grep -c . "$LIST"); n=0; okc=0; skip=0; failc=0
echo "批次开始 $(date -u +%FT%TZ) —— $total 首 → $LANG_CODE" | tee -a "$LOG"
while read -r wid; do
  [ -z "$wid" ] && continue
  n=$((n+1))
  st=$(psql "$DATABASE_URL" -X -q -t -A -c "select coalesce(status,'') from work_language_tracks where work_id='$wid'::uuid and lang='$LANG_CODE' and voice='auto'" 2>/dev/null)
  if [ "$st" = "ready" ]; then
    echo "[$n/$total] ${wid:0:8} 已有 ready 的 $LANG_CODE 轨 —— 跳过(断点续跑)" | tee -a "$LOG"
    skip=$((skip+1)); continue
  fi
  echo "[$n/$total] ${wid:0:8} 开始 $(date -u +%T)" | tee -a "$LOG"
  if bash "$HERE/w2277-add-mother-tongue-track.sh" "$wid" "$LANG_CODE" >>"$LOG" 2>&1; then
    okc=$((okc+1)); echo "[$n/$total] ${wid:0:8} OK $(date -u +%T)" | tee -a "$LOG"
  else
    failc=$((failc+1)); echo "[$n/$total] ${wid:0:8} FAILED $(date -u +%T) —— 不停整批, 末尾汇总" | tee -a "$LOG"
    echo "$wid" >> /tmp/w2277-batch-$LANG_CODE.failed
  fi
done < <(cat "$LIST"; echo)   # 补一个换行: 文件末尾没换行时 while read 会【静默吞掉最后一行】
                               # —— 批次自己的「三类加起来 ≠ 清单」自查正是这么报出来的
echo "批次结束 $(date -u +%FT%TZ)" | tee -a "$LOG"
echo "汇总: 清单 $total · 做成 $okc · 跳过 $skip · 失败 $failc" | tee -a "$LOG"
[ "$((okc+skip+failc))" -eq "$total" ] || echo "⚠ 三类加起来 $((okc+skip+failc)) ≠ 清单 $total —— 有漏判, 别信上面的数" | tee -a "$LOG"
