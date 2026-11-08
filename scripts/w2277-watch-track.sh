#!/bin/bash
# W2277 远端常驻轮询器 —— 不依赖 SSH 连接存活(api-vm 的 SSH 约每 60s 掉一次)。
#
# ⚠ 等到【字幕文件里出现这个语言】才算完, 不是等到 status=ready 就收工。
#   renderLanguageTrack 的字幕那一段是 setStatus("ready") 之后才 fire-and-forget 跑的
#   (情绪标注 + ♪1/♪2 各自强制对齐 + 音频富集, 还要好几分钟)。
#   只等 ready 会在批量里留下一批【有音频没字幕】的轨 —— 正是我们这两天在补的那种洞。
#   甘地那一首实测: 轨 ready 之后字幕又跑了十几分钟。
#
# ⚠ 取 CDN 必须带【唯一】的 cache-buster。固定的 ?t=xxx 在写入前取过一次就会被缓存住,
#   之后再取还是旧的 → 得出「字幕没写」的假结论。
set -a; . /etc/cssos.env 2>/dev/null; set +a
wid="$1"; lang="$2"; log="/tmp/w2277-watch-${wid:0:8}-$lang.log"
: > "$log"
track_done=""
for i in $(seq 1 180); do
  row=$(psql "$DATABASE_URL" -X -q -t -A -c "select status||'|'||coalesce(stage,'')||'|'||coalesce(progress_pct,0)::text||'|'||coalesce(length(lyrics),0)::text||'|'||coalesce(duration_secs,0)::text||'|'||coalesce(alt_duration_secs,0)::text from work_language_tracks where work_id='$wid'::uuid and lang='$lang' and voice='auto'" 2>&1)
  if [ -z "$row" ]; then
    echo "[$((i*20))s] NOROW 查不到这条轨 —— 不是还没好, 是真没这一行" >> "$log"
  else
    st=${row%%|*}
    case "$st" in
      failed) echo "[$((i*20))s] $row" >> "$log"; echo "DONE failed" >> "$log"; break;;
      ready)  track_done=1;;
    esac
    if [ -n "$track_done" ]; then
      langs=$(curl -s --max-time 45 -A "Mozilla/5.0 (Macintosh) cssos-audit" \
        "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM" \
        | python3 -c "
import json,sys
try: print(','.join(sorted(l['lang'] for l in json.load(sys.stdin).get('languages',[]))))
except Exception as e: print('FETCHERR')
" 2>/dev/null)
      echo "[$((i*20))s] $row | 字幕=[$langs]" >> "$log"
      case ",$langs," in
        *",$lang,"*) echo "DONE ready+subtitle" >> "$log"; break;;
      esac
      # 把【字幕还没写】和【我取不到文件】分开 —— 混在一起会把网络问题当成缺字幕
      [ "$langs" = "FETCHERR" ] && echo "   ↑ 注意: 这一轮是取文件失败, 不是字幕缺失" >> "$log"
    else
      echo "[$((i*20))s] $row" >> "$log"
    fi
  fi
  sleep 20
done
echo "EXIT" >> "$log"
