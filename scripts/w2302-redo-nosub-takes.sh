#!/bin/bash
# W2302 第六件: 给那 15 颗 ♪ 做【它自己那一版】的字幕。
#
# triage(w2302-triage-nosub.py)的结论: 15/15 都是「有版本行、subtitle_url 空、
# 作品级能回退看到」—— 不是没字幕, 是**没有这一版自己的**字幕。播放端回退到作品级
# = 拿作品级的时间轴配这一版的音频。Jerusalem ♪1 是 339.1s / ♪2 是 219.8s, 差 119 秒
# 却共用同一份 45 行时间轴, 至少一颗必然对不上。
#
# 一律 ?snap=1 —— 只写这一版自己的快照, 作品级 take1.json 字节不动
# (Jing:「不要再重新制作字幕, 旧版的情绪字幕很好。请保留。」)。每条跑完比指纹。
# 这些轨的 subtitle_url 本来是空的, 没有旧字节可存 —— 所以这一轮不会覆盖任何东西。
# 一条一条来(Jing:「不要几路并发」)。
set -u
APPLY="${1:-}"
IN="${2:-/tmp/w2302-nosub-in.tsv}"
set -a; . /etc/cssos.env; set +a
TOK="$CSSOS_ADMIN_TOKEN"
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'
T=/tmp/w2302-nosub-work; mkdir -p "$T"

q() { local s="$1" o r i; for i in 1 2 3; do
        o=$(PGCONNECT_TIMEOUT=10 psql "$DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$s" 2>/dev/null); r=$?
        [ "$r" -eq 0 ] && { printf '%s' "$o"; return 0; }; sleep $((i*3)); done
      printf '__QERR__'; return 1; }

# 清单先读进数组 —— while read 的循环体里有 curl/psql, 会吃掉循环自己的 stdin(W2275 的教训)
mapfile -t ROWS < "$IN"
N=${#ROWS[@]}
echo "清单 $N 颗 ♪ · $([ "$APPLY" = "--apply" ] && echo 真做 || echo 干跑)"
echo
ok=0; bad=0; unk=0; seen=0
for row in "${ROWS[@]}"; do
  [ -n "$row" ] || continue
  seen=$((seen+1))
  IFS=$'\t' read -r wid lang voice take title au nver sub lyrlen lyrhead wlvl <<<"$row"
  echo "[$seen/$N] ${wid:0:8}  $lang/$voice ♪$take  ${title:0:24}"

  # 现查(清单是 triage 时的快照, 中间可能变过)
  au_now=$(q "SELECT coalesce($([ "$take" = 1 ] && echo audio_url || echo alt_audio_url),'') FROM work_language_tracks WHERE work_id='$wid'::uuid AND coalesce(lang,'')='$lang' AND coalesce(voice,'')='$voice' LIMIT 1;")
  [ "$au_now" = "__QERR__" ] && { echo "        ‼ 查库失败 —— 判不了"; unk=$((unk+1)); echo; continue; }
  [ -n "$au_now" ] || { echo "        ‼ 没有音频 —— 跳过"; unk=$((unk+1)); echo; continue; }
  sub_now=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au_now' LIMIT 1;")
  [ "$sub_now" = "__QERR__" ] && { echo "        ‼ 查库失败 —— 判不了"; unk=$((unk+1)); echo; continue; }
  echo "        音频 $(basename "$au_now")"
  if [ -n "$sub_now" ]; then
    # triage 时是空的, 现在有了 → 中间有人做过。存档旧字节再继续(绝不无声覆盖)
    echo "        ⚠ 现在已经有字幕了(triage 时是空的)—— 先存旧字节"
    bf="$T/${wid:0:8}-$lang-$voice-$take.before.json"
    if [ "$(curl -s -A "$UA" -o "$bf" -w '%{http_code}' -m 60 "$sub_now")" = 200 ]; then
      sha=$(sha1sum "$bf" | cut -c1-24); key="artifacts/subtitle-archive/sub-$sha.json"
      if [ "$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$key")" != 200 ]; then
        ( cd /srv/cssos/current && node r2putkey.mjs "$bf" "$key" application/json >/dev/null 2>&1 ); sleep 2
      fi
      curl -s -A "$UA" "https://cdn.cssstudio.app/$key" -o "$T/rb.json"
      cmp -s "$bf" "$T/rb.json" && echo "        旧字节落 R2 ✅ sub-$sha.json" \
        || { echo "        ‼ 存档回读不一致 —— 停这一条"; unk=$((unk+1)); echo; continue; }
    else echo "        ‼ 旧字幕取不到 —— 判不了, 停这一条"; unk=$((unk+1)); echo; continue; fi
  fi

  wlf="$T/${wid:0:8}-worklevel.before.json"
  wcode=$(curl -s -A "$UA" -o "$wlf" -w '%{http_code}' -m 60 "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json")
  if [ "$wcode" = 200 ]; then before=$(sha1sum "$wlf" | cut -c1-16); else before="(无 HTTP $wcode)"; fi
  echo "        作品级指纹(动作前): $before"

  if [ "$APPLY" != "--apply" ]; then
    echo "        [干跑] 会 POST ?lang=$lang&voice=$voice&take=$take&snap=1"; ok=$((ok+1)); echo; continue
  fi

  out=$(curl -s -m 1800 -X POST -H "x-admin-token: $TOK" \
        "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$take&snap=1")
  if ! printf '%s' "$out" | grep -q '"ok":true'; then
    echo "        FAIL 接口没回 ok:true: $(printf '%s' "$out" | head -c 170)"
    bad=$((bad+1)); echo; continue
  fi
  wlang=$(printf '%s' "$out" | grep -o '"lang":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "        响应: 写进去的语言=$wlang  $(printf '%s' "$out" | grep -o '"words":[0-9]*' | head -1)  $(printf '%s' "$out" | grep -o '"clamp":{[^}]*}' | head -1 | cut -c1-76)"
  # 轨是真语言时, 写进去的 lang 必须就是它(W2297: 写对时间 ≠ 写对地方)
  case "$lang" in
    orig|auto|und|unknown|default|pre-epic|orig-pre-epic) ;;
    *) [ "$wlang" = "$lang" ] || { echo "        ‼ 语言写错: 写成 $wlang, 轨是 $lang —— 播放端读不到"; bad=$((bad+1)); echo; continue; } ;;
  esac

  newsub=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au_now' LIMIT 1;")
  python3 -I /tmp/w2302-check.py "$newsub" "${wlang:-$lang}" "$au_now" || { bad=$((bad+1)); echo; continue; }

  wcode2=$(curl -s -A "$UA" -o "$T/wl.after.json" -w '%{http_code}' -m 60 "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json")
  if [ "$wcode2" = 200 ]; then after=$(sha1sum "$T/wl.after.json" | cut -c1-16); else after="(无 HTTP $wcode2)"; fi
  if [ "$before" = "$after" ]; then echo "        作品级 take1.json: 指纹未变 ✅ (旧情绪字幕保住了)"
  else echo "        ‼ 作品级字幕被改动了! $before → $after —— 硬停"; bad=$((bad+1)); break; fi
  ok=$((ok+1)); echo
done
echo "汇总: 清单 $N · 实际过 $seen $([ "$seen" = "$N" ] && echo "✅无遗漏" || echo "⚠有漏") · 做成 $ok · 有问题 $bad · 判不了 $unk"
echo "VERDICT: W2302-nosub 结束(做成 $ok / 有问题 $bad / 判不了 $unk)"
