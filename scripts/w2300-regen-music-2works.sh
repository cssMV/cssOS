#!/usr/bin/env bash
# W2300 第二步 —— 凯撒 / 奥古斯都: 拿第一步的京典歌词生成整首音乐, 再做情绪字幕。
#
# Jing 2026-11-11 明确 yes:「两个都做」(针对「这两个作品只有 30 秒 demo + 零歌词,
# 要补齐得重新生成歌词和完整音乐, 是否要做?」)。
#
# 走 /api/admin/regen-track-audio —— 平台自己那条路, 不另起炉灶。它已经做对三件事:
#   ① 旧字节【先立碑】再生成(registerMediaVersion), 顺序不颠倒;
#   ② 走同一个 callMusicGen(默认只 suno/kie, 架构宪法);
#   ③ 落盘到我们域名 + 内容哈希命名 + 重对时间轴。
# 它【没做】的两件, 这里补上并核对:
#   · user_works.preview_audio_url 还指着那段 30 秒 demo(makeCurrent 只翻 is_current);
#   · user_works.duration_secs 还是 30。这一列的语义是「♪1 的时长」(W367), 必须填【实测】值。
#
# 时长一律【整段解码】—— mp3/m4a 的头会谎报(W2297 实测谎报过 +131s)。
# 字幕不带 ?lyrics_url=: 这两个作品没有 lyrics.json, 兜底链会落到轨.lyrics,
# 而那正是这一步刚写进去的干净京典词。
#
# 不并发(Jing:「一个一个来」): 先等 W2298 那 6 颗 ♪ 收尾, 且要求它是正常收尾。
set -u
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
DB=$(grep -m1 '^DATABASE_URL=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
TOK=$(grep -m1 '^CSSOS_ADMIN_TOKEN=' /etc/cssos.env | cut -d= -f2- | tr -d '"')
[ -n "$DB" ] && [ -n "$TOK" ] || { echo "FAIL 缺 DATABASE_URL / CSSOS_ADMIN_TOKEN —— 判不了, 停手"; exit 2; }
API=http://127.0.0.1:3000
UA='Mozilla/5.0 (Macintosh) cssos-audit'

if [ -n "${WAIT_LOG:-}" ]; then
  echo "等 ${WAIT_LOG} 出结论(不与它同时跑)…"
  while ! grep -q '^VERDICT:' "$WAIT_LOG" 2>/dev/null; do sleep 60; done
  v=$(grep '^VERDICT:' "$WAIT_LOG" | tail -1)
  echo "  前一步: $v"
  # 必须【既没问题也没有判不了】才往下走。判不了 = 我没看清, 看不清就不该接着花钱。
  case "$v" in
    *"有问题 0 / 判不了 0"*) echo "  前一步干净收尾 ✅" ;;
    *) if [ "${REVIEWED:-}" = "1" ]; then
         # 显式的【已人工复核】开关 —— 不改上面的判据, 所以下次同类情况它照样会拦。
         # 本次放行依据(W2301): W2298 报「有问题 2」的是 Valhǫll ♪1/♪2, C 判据过严 ——
         #   字幕 22 行 = 干净歌词 22 行, 4 处差别是对齐引擎按【唱出来的】掉了虚词
         #   (þú / í / á / ææ)。换成【是歌词某一行的子序列】重判, 两颗全过;
         #   同一把新尺子对 Cocijo 那行英文说明仍判失败(反向校准)。故实为 6/6。
         echo "  前一步有问题, 但已人工复核放行(REVIEWED=1): $v"
       else
         echo "  ‼ 前一步不是干净收尾 —— 不接着花钱生成。先让人看一眼。"
         echo "VERDICT: W2300 未开工(前一步 $v)"; exit 3
       fi ;;
  esac
fi

q() { local s="$1" o r i; for i in 1 2 3; do
        o=$(PGCONNECT_TIMEOUT=10 psql "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "$s" 2>/dev/null); r=$?
        [ "$r" -eq 0 ] && { printf '%s' "$o"; return 0; }; sleep $((i*3)); done
      printf '__QERR__'; return 1; }
dur_of() { ffmpeg -nostdin -hide_banner -i "$1" -f null - 2>&1 \
  | grep -o 'time=[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9]*' | tail -1 | sed 's/time=//' \
  | awk -F: '{printf "%.1f", $1*3600+$2*60+$3}'; }

ROWS=( "0b02ba6b-862b-4587-a0ab-8410f4c78056|la|auto|caesar|凯撒 · 罗马号角"
       "4b837997-b212-4240-8b23-c4dad241c33e|la|auto|augustus|奥古斯都 · 庄严管弦" )

echo "清单 ${#ROWS[@]} 个作品 $( [ "$APPLY" = 1 ] && echo '· 真做' || echo '· 干跑' )"
n=0; okn=0; badn=0; unk=0
for r in "${ROWS[@]}"; do
  IFS='|' read -r wid lang voice tag title <<<"$r"; n=$((n+1))
  LYR=/tmp/w2300/$tag.lyrics.txt
  printf '\n[%d/%d] %s  %s  %s\n' "$n" "${#ROWS[@]}" "${wid:0:8}" "$title" "$lang/$voice"
  [ -s "$LYR" ] || { echo "        ‼ 没有歌词文件 $LYR —— 判不了"; unk=$((unk+1)); continue; }
  secs=$(grep -cE '^[[:space:]]*\[[^]]*\][[:space:]]*$' "$LYR")
  body=$(grep -vE '^[[:space:]]*\[[^]]*\][[:space:]]*$' "$LYR" | grep -cE '[A-Za-z]')
  echo "        歌词 ${secs} 节 / ${body} 行"
  if [ "$secs" -lt 10 ] || [ "$body" -lt 40 ]; then
    echo "        ‼ 不足 10 节 / 40 行(歌词完整度铁律)—— 不生成"; badn=$((badn+1)); continue; fi

  old=$(q "SELECT coalesce(audio_url,'') FROM work_language_tracks
            WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice' LIMIT 1;")
  [ "$old" != "__QERR__" ] || { echo "        ‼ 查库失败 —— 判不了"; unk=$((unk+1)); continue; }
  oldd=$(dur_of "$old")
  echo "        旧音频 ${oldd}s  ${old##*/}"

  if [ "$APPLY" != 1 ]; then
    echo "        [干跑] 会 POST /api/admin/regen-track-audio/$wid  lang=$lang voice=$voice"
    echo "               old_label='30秒 demo(原版)'  new_label='完整版 · 京典十节'"
    echo "               然后: 实测新时长 → 更新 user_works.preview_audio_url + duration_secs → resubtitle → 校验"
    continue
  fi

  body_json=$(python3 -I -c '
import json,sys
print(json.dumps({"lang":sys.argv[1],"voice":sys.argv[2],
                  "lyrics":open(sys.argv[3],encoding="utf-8").read(),
                  "old_label":"30秒 demo(原版)","new_label":"完整版 · 京典十节"}, ensure_ascii=False))' \
    "$lang" "$voice" "$LYR")
  out=$(curl -s -m 2400 -X POST -H "x-admin-token: $TOK" -H 'Content-Type: application/json' \
        -d "$body_json" "$API/api/admin/regen-track-audio/$wid")
  printf '%s' "$out" > /tmp/w2300/$tag.regen.json
  echo "        响应: $(printf '%s' "$out" | head -c 300)"
  newu=$(printf '%s' "$out" | python3 -I -c 'import json,sys
try: print(json.load(sys.stdin).get("new_audio_url") or "")
except Exception: print("")')
  altu=$(printf '%s' "$out" | python3 -I -c 'import json,sys
try: print(json.load(sys.stdin).get("alt_audio_url") or "")
except Exception: print("")')
  [ -n "$newu" ] || { echo "        ⚠ 没拿到新音频 URL"; badn=$((badn+1)); continue; }

  # ① 落在我们域名 + 内容哈希命名(铁律两条)
  case "$newu" in https://cdn.cssstudio.app/*) ;; *) echo "        ⚠ 新音频不在我们域名上: $newu"; badn=$((badn+1)); continue;; esac
  case "${newu##*/}" in aud-[0-9a-f]*) echo "        ✅ 内容哈希命名 ${newu##*/}" ;;
       *) echo "        ⚠ 不是内容哈希命名: ${newu##*/}" ;; esac
  # ② 旧字节还在, 且在胶囊里有自己带名字的一行
  ocode=$(curl -s -o /dev/null -w '%{http_code}' -m 25 -A "$UA" "$old")
  orow=$(q "SELECT coalesce(label,'(无名)')||' / '||coalesce(duration_secs::text,'?')||'s'
             FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$old' LIMIT 1;")
  echo "        旧版: HTTP $ocode  胶囊里那一行: ${orow:-(没有!)}"
  [ "$ocode" = 200 ] && [ -n "$orow" ] && [ "$orow" != "__QERR__" ] \
    || { echo "        ‼ 旧版没保住 —— 这是最要紧的一条"; badn=$((badn+1)); }
  # ③ 实测新时长(不读头)
  nd=$(dur_of "$newu"); ad=""; [ -n "$altu" ] && ad=$(dur_of "$altu")
  echo "        新 ♪1 实测 ${nd}s $( [ -n "$altu" ] && echo "· ♪2 实测 ${ad}s" )"
  [ -n "${nd:-}" ] || { echo "        ‼ 新音频解码不出时长 —— 不写 duration_secs(宁可空着, 不写错数)"; unk=$((unk+1)); continue; }
  ndi=$(printf '%.0f' "$nd")
  # ④ 补端点没做的两件: 作品首页的音频指针 + ♪1 时长(实测值)
  q "UPDATE user_works SET preview_audio_url='$newu', duration_secs=$ndi, updated_at=now() WHERE id='$wid'::uuid;" >/dev/null
  q "UPDATE work_language_tracks SET duration_secs=$ndi WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice';" >/dev/null
  if [ -n "${ad:-}" ]; then adi=$(printf '%.0f' "$ad")
    q "UPDATE work_language_tracks SET alt_duration_secs=$adi WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice';" >/dev/null; fi
  echo "        已改指针: preview_audio_url → 新 ♪1 · duration_secs=$ndi(实测)"
  # ⑤ 情绪字幕(轨.lyrics 已是干净京典词, 不需要 ?lyrics_url=)
  for tk in 1 2; do
    [ "$tk" = 2 ] && [ -z "$altu" ] && continue
    so=$(curl -s -m 1800 -X POST -H "x-admin-token: $TOK" \
         "$API/api/admin/resubtitle/$wid?lang=$lang&voice=$voice&take=$tk&snap=1")
    echo "        字幕 ♪$tk: $(printf '%s' "$so" | head -c 170)"
    if [ "$tk" = 1 ]; then surl=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks
                                      WHERE work_id='$wid'::uuid AND lang='$lang' AND coalesce(voice,'auto')='$voice' LIMIT 1;")
                           sdur=$nd
    else surl=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions
                    WHERE work_id='$wid'::uuid AND kind='audio' AND url='$altu' LIMIT 1;"); sdur=$ad; fi
    if [ -z "$surl" ] || [ "$surl" = "__QERR__" ]; then echo "        ‼ ♪$tk 查不到字幕地址 —— 判不了"; unk=$((unk+1)); continue; fi
    vr=$(python3 -I /tmp/w2298-verify.py "$surl" "$lang" "$sdur" "$LYR" 2>&1); vrc=$?
    case "$vrc" in 0) echo "        ✅ ♪$tk $vr"; okn=$((okn+1));;
                   1) echo "        ⚠ ♪$tk $vr"; badn=$((badn+1));;
                   *) echo "        ‼ ♪$tk $vr"; unk=$((unk+1));; esac
  done
done
echo
echo "汇总: 清单 ${#ROWS[@]} · 实际处理 $n $( [ "$n" = "${#ROWS[@]}" ] && echo '✅无遗漏' || echo '⚠有漏' ) · 字幕做成 $okn · 有问题 $badn · 判不了 $unk"
echo "VERDICT: W2300 结束(做成 $okn / 有问题 $badn / 判不了 $unk)"
