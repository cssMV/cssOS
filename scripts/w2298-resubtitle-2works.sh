#!/usr/bin/env bash
# W2298 —— 两个长尾语言作品的字幕重做: Cocijo(zap) / Valhǫll(non), 共 6 颗 ♪。
#
# 为什么不能直接跑 W2296 那条批量: 污染不在字幕里, 在【歌词源】里。
#   端点取词的顺序是 ?lyrics_url= → R2 lyrics.json(本轨语言) → 轨.lyrics → lyrics_preview,
#   而这两个作品的 lyrics.json 条目本身就是脏的:
#     Valhǫll 的 non 条目整份是 LLM 的反问(「non 不是我认识的语言, 你要哪一种?」);
#     Cocijo  的 zap 条目 23 行真词之后多了一行 LLM 的英文说明。
#   不带 ?lyrics_url= 重做 = 把那段话再对齐一遍。实测过才下这个结论。
#
# 做法: 用【库里已经有的干净词】生成纯文本, 传到 R2(内容哈希命名), 经 ?lyrics_url= 喂进去。
#   · 一个字都不是新写的 —— Cocijo 用 lyrics.json 的 23 行真词, Valhǫll 用 work_language_tracks.lyrics
#     那 22 行古诺斯语(它一直在库里, 只是排在 lyrics.json 后面所以从没被用上)。
#   · lyrics.json 的旧字节【一个字节都不动】 —— 版本铁律: 旧的要有自己的地址, 不覆盖。
#   · 一律 ?snap=1 —— 只写该版本自己的快照, 作品级 subtitle-take1.json 不碰
#     (Jing:「不要再重新制作字幕，旧版的情绪字幕很好。请保留。」) 跑完逐个核对它没变。
#
# 不并发(Jing:「一个一个来」): 先确认 W2296 那条批量真的跑完(日志里有「汇总:」), 才开工。
#
# 用法: bash w2298-run.sh            # 干跑(只打算做什么, 不写)
#       bash w2298-run.sh --apply    # 真做
#       WAIT_PID=<pid> bash w2298-run.sh --apply   # 等那条批量退出后再做
set -u
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
DB=$(grep -m1 '^DATABASE_URL=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
TOK=$(grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
[ -n "$DB" ] || { echo "FAIL 没有 DATABASE_URL —— 判不了, 停手"; exit 2; }
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'
ARC=/tmp/w2298-archive; mkdir -p "$ARC"

LYR_COCIJO=https://cdn.cssstudio.app/artifacts/lyrics/lyr-b992a135d1e70e1ac85d0b1f.txt
LYR_VALHOLL=https://cdn.cssstudio.app/artifacts/lyrics/lyr-521e83cd355591e22007ae21.txt

# ── 不并发: 等那条批量退出, 并且要求它是【正常跑完】而不是被杀 ──────────────
if [ -n "${WAIT_PID:-}" ]; then
  echo "等 pid ${WAIT_PID} 退出(不与它同时跑)…"
  while ps -p "$WAIT_PID" >/dev/null 2>&1; do sleep 60; done
  echo "它退出了。"
  if [ -n "${WAIT_LOG:-}" ]; then
    if grep -q '^汇总:' "$WAIT_LOG" 2>/dev/null; then
      echo "  它的日志里有「汇总:」= 正常跑完 ✅  $(grep '^汇总:' "$WAIT_LOG" | tail -1)"
    else
      echo "  ‼ 它的日志里【没有汇总】= 被杀或崩了, 不是跑完。"
      echo "  不接着往下做 —— 前一步的结果没确认, 后一步就不该开始。"
      echo "VERDICT: 前置批量异常收尾, W2298 一行未做"
      exit 3
    fi
  fi
fi

q() {
  local sql="$1" out rc i
  for i in 1 2 3; do
    out=$(PGCONNECT_TIMEOUT=10 psql "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "$sql" 2>/dev/null); rc=$?
    [ "$rc" -eq 0 ] && { printf '%s' "$out"; return 0; }
    sleep $((i*3))
  done
  printf '__QERR__'; return 1            # 「查不到」和「没有」必须分开(W2297)
}

dur_of() {   # 整段解码 —— mp3 头会谎报(W2297)
  ffmpeg -nostdin -hide_banner -i "$1" -f null - 2>&1 \
    | grep -o 'time=[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9]*' | tail -1 \
    | sed 's/time=//' | awk -F: '{printf "%.1f", $1*3600+$2*60+$3}'
}

sha_of() { curl -s -m 60 -A "$UA" "$1" | sha256sum | cut -c1-16; }

# 该版本现在解析到哪一份字幕: ♪1 看轨那一列, ♪2 看版本行(按 audio_url 配, 不按 lang —— W2145)
sub_for() { # $1=wid $2=lang $3=voice $4=take $5=audio_url
  if [ "$4" = 1 ]; then
    q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks
        WHERE work_id='$1'::uuid AND lang='$2' AND coalesce(voice,'auto')='$3' LIMIT 1;"
  else
    q "SELECT coalesce(subtitle_url,'') FROM work_media_versions
        WHERE work_id='$1'::uuid AND kind='audio' AND url='$5' LIMIT 1;"
  fi
}

ROWS=(
  "0d8574c2-0f9c-46be-b070-e124ffb8df5d|zap|auto|1|$LYR_COCIJO|cocijo|Cocijo"
  "0d8574c2-0f9c-46be-b070-e124ffb8df5d|zap|auto|2|$LYR_COCIJO|cocijo|Cocijo"
  "0d8574c2-0f9c-46be-b070-e124ffb8df5d|zap|pre-epic|1|$LYR_COCIJO|cocijo|Cocijo"
  "0d8574c2-0f9c-46be-b070-e124ffb8df5d|zap|pre-epic|2|$LYR_COCIJO|cocijo|Cocijo"
  "8e751d8e-279f-498b-8c18-03e8707ef070|non|auto|1|$LYR_VALHOLL|valholl|Valhǫll"
  "8e751d8e-279f-498b-8c18-03e8707ef070|non|auto|2|$LYR_VALHOLL|valholl|Valhǫll"
)

echo "清单 ${#ROWS[@]} 颗 ♪ $( [ "$APPLY" = 1 ] && echo '· 真做' || echo '· 干跑' )"
echo
n=0; okn=0; badn=0; unk=0
for r in "${ROWS[@]}"; do
  IFS='|' read -r wid lang voice take lyrurl lyrtag title <<<"$r"
  n=$((n+1))
  printf '[%d/%d] %s  %s/%s ♪%s  %s\n' "$n" "${#ROWS[@]}" "${wid:0:8}" "$lang" "$voice" "$take" "$title"

  if [ "$take" = 1 ]; then col=audio_url; else col=alt_audio_url; fi
  au=$(q "SELECT coalesce($col,'') FROM work_language_tracks
           WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice' LIMIT 1;")
  if [ "$au" = "__QERR__" ]; then echo "        ‼ 查库失败 —— 判不了, 跳过(不是「没有」)"; unk=$((unk+1)); continue; fi
  [ -n "$au" ] || { echo "        这一版没有音频 —— 无事可做"; continue; }

  ad=$(dur_of "$au")
  [ -n "${ad:-}" ] || { echo "        ‼ 音频解码不出时长 —— 判不了, 不做(宁可不做, 不按错数字剪)"; unk=$((unk+1)); continue; }
  before_url=$(sub_for "$wid" "$lang" "$voice" "$take" "$au")
  if [ "$before_url" = "__QERR__" ]; then echo "        ‼ 查不到它现在读哪份字幕 —— 判不了, 跳过"; unk=$((unk+1)); continue; fi
  wl_url=$(q "SELECT coalesce(subtitle_take1_json_url,'') FROM user_works WHERE id='$wid'::uuid;")
  wl_before=""; [ -n "$wl_url" ] && [ "$wl_url" != "__QERR__" ] && wl_before=$(sha_of "$wl_url")

  echo "        音频 ${ad}s  ${au##*/}"
  echo "        动作前读: ${before_url:-(无, 回退作品级)}"
  echo "        作品级 take1.json 指纹(动作前): ${wl_before:-(无)}"

  if [ "$APPLY" != 1 ]; then
    echo "        [干跑] 会 POST ?lang=$lang&voice=$voice&take=$take&snap=1&lyrics_url=…${lyrurl##*/}"
    continue
  fi

  # 动作前的旧字节存一份 —— 不是为了回滚(只增不覆盖), 是为了随时能把旧版拿出来看
  if [ -n "$before_url" ]; then
    curl -s -m 60 -A "$UA" "$before_url" -o "$ARC/${wid:0:8}-$voice-take$take.before.json"
  fi

  out=$(curl -s -m 1800 -X POST -H "x-admin-token: $TOK" \
        "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$take&snap=1&lyrics_url=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$lyrurl")")
  echo "        响应: $(printf '%s' "$out" | head -c 240)"
  printf '%s' "$out" > "$ARC/${wid:0:8}-$voice-take$take.resp.json"

  # 判据查的那一条, 由动作自己报出来 —— 不许按请求值假定(W2297)
  wlang=$(printf '%s' "$out" | grep -o '"lang":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "${wlang:-}" ] || wlang="$lang"
  if [ "$wlang" != "$lang" ]; then
    echo "        ⚠ 写成了 $wlang, 轨是 $lang —— 播放端读不到"; badn=$((badn+1)); continue
  fi

  sleep 3
  after_url=$(sub_for "$wid" "$lang" "$voice" "$take" "$au")
  if [ "$after_url" = "__QERR__" ] || [ -z "$after_url" ]; then
    echo "        ‼ 做完之后查不到它读哪份字幕 —— 判不了"; unk=$((unk+1)); continue
  fi
  echo "        动作后读: $after_url"
  v=$(python3 -I /tmp/w2298-verify.py "$after_url" "$lang" "$ad" "/tmp/w2298-lyr-$lyrtag.txt" 2>&1); vrc=$?
  case "$vrc" in
    0) echo "        ✅ $v"; okn=$((okn+1)) ;;
    1) echo "        ⚠ $v"; badn=$((badn+1)) ;;
    *) echo "        ‼ $v"; unk=$((unk+1)) ;;
  esac

  # 作品级那一份必须一个字节都没变
  if [ -n "$wl_before" ]; then
    wl_after=$(sha_of "$wl_url")
    if [ "$wl_after" = "$wl_before" ]; then
      echo "        作品级 take1.json: 指纹未变 ✅ (旧情绪字幕保住了)"
    else
      echo "        ‼‼ 作品级 take1.json 被改了($wl_before → $wl_after) —— 违反「旧版情绪字幕请保留」, 立刻停手"
      badn=$((badn+1)); break
    fi
  fi
done

echo
echo "汇总: 清单 ${#ROWS[@]} · 实际处理 $n $( [ "$n" = "${#ROWS[@]}" ] && echo '✅无遗漏' || echo '⚠有漏' ) · 做成 $okn · 有问题 $badn · 判不了 $unk"
echo "旧字节存档: $ARC"
echo "VERDICT: W2298 结束(做成 $okn / 有问题 $badn / 判不了 $unk)"
