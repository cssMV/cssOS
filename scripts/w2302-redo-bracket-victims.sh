#!/bin/bash
# W2302: 重做【真的是跨行方括号块】受害的那几条字幕。
# 一条一条来(Jing:「不要几路并发」)。每条都: 旧字节先落 R2 → 作品级指纹 → 做 → 验 → 比指纹。
set -u
APPLY="${1:-}"
set -a; . /etc/cssos.env; set +a
TOK="$CSSOS_ADMIN_TOKEN"
[ -n "$TOK" ] || { echo "FAIL 没有 CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'
ARC=/tmp/w2302-arc; mkdir -p "$ARC"

q() { local s="$1" o r i; for i in 1 2 3; do
        o=$(PGCONNECT_TIMEOUT=10 psql "$DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$s" 2>/dev/null); r=$?
        [ "$r" -eq 0 ] && { printf '%s' "$o"; return 0; }; sleep $((i*3)); done
      printf '__QERR__'; return 1; }

ROWS=(
  "a9b47fd9-eb70-4d14-9ece-9e800b404670|ja|auto|1|祇園精舎の鐘の声 The Bells"
  "056c5a62-517c-452a-a34c-3566d942ad6e|orig|auto|1|祇園精舎の鐘の声"
  "907f2e2e-4d2f-4efe-9995-7e2b14b38c1a|orig|auto|1|祇園精舎の鐘の声 The Bells"
)
echo "清单 ${#ROWS[@]} 条 · $([ "$APPLY" = "--apply" ] && echo 真做 || echo 干跑)"
echo
ok=0; bad=0; unk=0; n=0
for row in "${ROWS[@]}"; do
  n=$((n+1))
  IFS='|' read -r wid lang voice take title <<<"$row"
  echo "[$n/${#ROWS[@]}] ${wid:0:8}  $lang/$voice ♪$take  $title"

  au=$(q "SELECT coalesce($([ "$take" = 1 ] && echo audio_url || echo alt_audio_url),'') FROM work_language_tracks WHERE work_id='$wid'::uuid AND coalesce(lang,'')='$lang' AND coalesce(voice,'')='$voice' LIMIT 1;")
  [ "$au" = "__QERR__" ] && { echo "        ‼ 查库失败 —— 判不了"; unk=$((unk+1)); continue; }
  [ -n "$au" ] || { echo "        ‼ 没有音频 —— 跳过"; unk=$((unk+1)); continue; }
  sub=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au' LIMIT 1;")
  [ "$sub" = "__QERR__" ] && { echo "        ‼ 查库失败 —— 判不了"; unk=$((unk+1)); continue; }
  echo "        音频 $(basename "$au")"
  echo "        动作前字幕: ${sub:-(无, 回退作品级)}"

  # 旧字节落 R2(内容哈希)—— /tmp 会被清
  if [ -n "$sub" ]; then
    bf="$ARC/${wid:0:8}-$lang-$voice-take$take.before.json"
    code=$(curl -s -A "$UA" -o "$bf" -w '%{http_code}' -m 60 "$sub")
    if [ "$code" = 200 ]; then
      sha=$(sha1sum "$bf" | cut -c1-24); key="artifacts/subtitle-archive/sub-$sha.json"
      ecode=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -A "$UA" "https://cdn.cssstudio.app/$key")
      if [ "$ecode" = 200 ]; then echo "        旧字节已在 R2(幂等)"
      else
        ( cd /srv/cssos/current && node r2putkey.mjs "$bf" "$key" application/json >/dev/null 2>&1 )
        sleep 2
        curl -s -A "$UA" "https://cdn.cssstudio.app/$key" -o "$ARC/rb.json"
        if cmp -s "$bf" "$ARC/rb.json"; then echo "        旧字节落 R2 ✅ sub-$sha.json ($(wc -c < "$bf") B)"
        else echo "        ‼ 存档回读不一致 —— 不动它, 停这一条"; unk=$((unk+1)); continue; fi
      fi
    else echo "        ‼ 旧字幕取不到 HTTP $code —— 判不了, 停这一条"; unk=$((unk+1)); continue; fi
  fi

  # 作品级指纹(必须纹丝不动)
  wlf="$ARC/${wid:0:8}-worklevel.before.json"
  wcode=$(curl -s -A "$UA" -o "$wlf" -w '%{http_code}' -m 60 "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json")
  if [ "$wcode" = 200 ]; then before=$(sha1sum "$wlf" | cut -c1-16); else before="(无作品级 HTTP $wcode)"; fi
  echo "        作品级指纹(动作前): $before"

  if [ "$APPLY" != "--apply" ]; then echo "        [干跑] 会 POST ?lang=$lang&voice=$voice&take=$take&snap=1"; ok=$((ok+1)); echo; continue; fi

  out=$(curl -s -m 1800 -X POST -H "x-admin-token: $TOK" \
        "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$take&snap=1")
  if ! printf '%s' "$out" | grep -q '"ok":true'; then
    echo "        FAIL 接口没回 ok:true: $(printf '%s' "$out" | head -c 170)"; bad=$((bad+1)); echo; continue
  fi
  wlang=$(printf '%s' "$out" | grep -o '"lang":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "        响应: 写进去的语言=$wlang  $(printf '%s' "$out" | grep -o '"words":[0-9]*' | head -1)  $(printf '%s' "$out" | grep -o '"clamp":{[^}]*}' | head -1 | cut -c1-90)"

  newsub=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au' LIMIT 1;")
  python3 -I /tmp/w2302-check.py "$newsub" "${wlang:-$lang}" "$au" || bad=$((bad+1))

  wcode2=$(curl -s -A "$UA" -o "$ARC/wl.after.json" -w '%{http_code}' -m 60 "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json")
  if [ "$wcode2" = 200 ]; then after=$(sha1sum "$ARC/wl.after.json" | cut -c1-16); else after="(无作品级 HTTP $wcode2)"; fi
  if [ "$before" = "$after" ]; then echo "        作品级 take1.json: 指纹未变 ✅ (旧情绪字幕保住了)"
  else echo "        ‼ 作品级字幕被改动了! $before → $after —— 硬停"; bad=$((bad+1)); break; fi
  ok=$((ok+1)); echo
done
echo "汇总: 清单 ${#ROWS[@]} · 实际过 $n $([ "$n" = "${#ROWS[@]}" ] && echo "✅无遗漏" || echo "⚠有漏") · 做成 $ok · 有问题 $bad · 判不了 $unk"
echo "VERDICT: W2302-redo 结束(做成 $ok / 有问题 $bad / 判不了 $unk)"
