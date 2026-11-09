#!/usr/bin/env bash
# W2281 —— Dog walker 两首: 手写英文词【新起一个版本】, 且不许把旧版的字幕弄丢。
#
# 为什么这两首不能照 10 首苏武那样直接跑:
#   苏武那 10 首新版是 lang=zh, 旧版是 lang=en —— 作品级 subtitle-take1.json 里
#   languages['zh'] 与 languages['en'] 是两条互不相干的条目, 新增一条不动旧的。
#   Dog walker 两首旧版就是 lang=en, 新版也只能是 lang=en(换 voice 占新槽),
#   而生成管线末尾 upsertSubtitleJson(workId,'en',1,…) 是【按语言合并】——
#   它会把 languages['en'] 整条替换成新版的时间轴。
#   两条轨的 subtitle_url 又都是 NULL(播放端只能回退作品级那一份),
#   于是【旧版歌声 + 新版时间轴】—— 正是 W2145/W2267 那个失败形状。
#
# 所以这里把【版本自己的字幕挂在版本自己身上】这一步补上, 按平台既有的约定来:
#   键名 works/<id>/subtitle-take1--a<sha1(audio_url)[:10]>.json  —— 与
#   src/index.ts 的 upsertSubtitleJson 一字不差(不另造一套命名)。
#   列是 work_language_tracks.subtitle_url —— 也是平台既有的那一列。
#   先给【旧版】挂, 再生成新版, 最后给【新版】挂。
#
# 只动这两首各自的两行, 不碰共享代码: 生成管线那一处漏传 audioUrl(=1307 行
# subtitle_url 全空的真因)是另一件事, 已单独报给 Jing, 不在这里顺手改。
#
# 用法: bash w2281-dogwalker-version.sh <manifest.tsv> [--apply]
#   清单每行三列(与 w2279-batch-handwritten.sh 同一个格式, 不另立):
#     <workId> <TAB> <lang> <TAB> <lyrics 路径或文件名>
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PAIRS="${1:?用法: w2281-dogwalker-version.sh <pairs.tsv> [--apply]}"
APPLY=0; [ "${2:-}" = "--apply" ] && APPLY=1
LYRDIR="${LYRDIR:-/tmp/w2281/lyrics}"
VOICE="${VOICE:-masculine}"
CUR=/srv/cssos/current
set -a; . /etc/cssos.env; set +a
: "${DATABASE_URL:?没有 DATABASE_URL}"
: "${CSSOS_ADMIN_TOKEN:?没有 CSSOS_ADMIN_TOKEN}"
mkdir -p /tmp/w2281/dogwalker

q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }

plan=0; done_n=0; fail_n=0
FAILED=/tmp/w2281-dogwalker.failed; : > "$FAILED"

snap_for_track() {   # $1=workId $2=track_id $3=audio_url $4=tag(old/new) $5=lang
  local wid="$1" tid="$2" au="$3" who="$4" lg="$5"
  local tag src key url
  tag=$(printf '%s' "$au" | sha1sum | cut -c1-10)
  src=/tmp/w2281/dogwalker/$wid--$who.json
  local code
  code=$(curl -s -o "$src" -w "%{http_code}" -A "Mozilla/5.0 (Macintosh) cssos-audit" \
    "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")
  [ "$code" = "200" ] && [ -s "$src" ] || { echo "   FAIL 作品级字幕取不到(http $code) —— 判不了就不写"; return 1; }
  python3 -I -c '
import json,sys
j=json.load(open(sys.argv[1]))
lg=sys.argv[2].lower()
langs=j.get("languages") or []
hit=[L for L in langs if str(L.get("lang","")).lower().startswith(lg)]
if not hit: sys.exit(f"   FAIL 作品级字幕里没有 {lg} 条目 —— 不是我要快照的东西")
n=sum(len(s.get("lines") or []) for s in (hit[0].get("sections") or []))
print(f"   作品级 {lg} 字幕 {n} 行")
' "$src" "$lg" || return 1
  key="works/$wid/subtitle-take1--a$tag.json"
  url="https://cdn.cssstudio.app/$key"
  if [ "$APPLY" = "0" ]; then echo "   [干跑] 会写 $key 并挂到轨 $tid"; return 0; fi
  # 永不覆盖 —— 但「同样的字节写回同一个地址」是幂等, 不是覆盖(内容哈希命名的同一条道理)。
  # 所以键已存在时先把它拉下来逐字节比: 一样就接受, 不一样就停手。
  if [ "$(curl -s -o /tmp/w2281/dogwalker/.exists -w '%{http_code}' "$url")" = "200" ]; then
    if cmp -s /tmp/w2281/dogwalker/.exists "$src"; then
      echo "   $key 已存在且字节完全相同 —— 幂等, 接受"
    else
      echo "   FAIL $key 已存在且字节不同 —— 不覆盖, 停手"; return 1
    fi
  else
    # r2putkey.mjs 打的是 JSON {"ok":true,"key":…,"bytes":…}, 不是 URL ——
    # 公网地址要自己按 cdn.cssstudio.app/<key> 拼(全库 53 条既有 subtitle_url 都是这个形状)。
    local put
    put=$( cd "$CUR" && node r2putkey.mjs "$src" "$key" "application/json" 2>/dev/null | tail -1 )
    case "$put" in *'"ok":true'*) ;; *) echo "   FAIL 推 R2 失败: $put"; return 1;; esac
    # 推完必须回读 —— 「打印了 ok」不等于「CDN 上取得到」
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = "200" ] || { echo "   FAIL 推完 CDN 取不到 $url"; return 1; }
  fi
  q "UPDATE work_language_tracks SET subtitle_url='$url', updated_at=now()
      WHERE id=$tid AND coalesce(subtitle_url,'')='';" >/dev/null || { echo "   FAIL UPDATE 失败"; return 1; }
  local back; back=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE id=$tid;")
  [ "$back" = "$url" ] || { echo "   FAIL 回读不一致: 库里是 '$back'"; return 1; }
  echo "   OK 轨 $tid 的 subtitle_url 已挂 ($who) $key"
}

while IFS=$'\t' read -r wid lang lyr; do
  wid="$(printf '%s' "${wid:-}" | tr -d '[:space:]')"
  lang="$(printf '%s' "${lang:-}" | tr -d '[:space:]')"
  lyr="$(printf '%s' "${lyr:-}" | tr -d '[:space:]')"
  [ -n "$wid" ] || continue
  case "$wid" in \#*) continue;; esac
  plan=$((plan+1))
  if [ -z "$lang" ] || [ -z "$lyr" ]; then
    echo "=== [$plan] $wid —— FAIL 清单这一行不是三列(lang='$lang' 词='$lyr')"
    echo "$wid	$lyr	清单行不是三列" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  echo "=== [$plan] $wid  $lang ← $(basename "$lyr")"
  case "$lyr" in /*) f="$lyr";; *) f="$LYRDIR/$lyr";; esac
  [ -f "$f" ] || { echo "   FAIL 词文件不在 $f"; echo "$wid	$lyr	词文件不在" >>"$FAILED"; fail_n=$((fail_n+1)); continue; }

  # 1 词本身先过两道闸(与语言轨那一路同一个判据, 不另写)。
  #   检查器自己从【文件名后缀】取语言, 所以先确认它与清单那一列一致 ——
  #   两边不一致时它会拿文件名那个去判, 而我按清单那个去写库, 两头对不上还没人报。
  fl="$(basename "$f"; )"; fl="${fl%.*}"; fl="${fl##*-}"
  if [ "$fl" != "$lang" ]; then
    echo "   FAIL 清单写 lang=$lang, 但文件名后缀是 -$fl —— 两边不一致, 不猜"
    echo "$wid	$lyr	lang 与文件名后缀不一致" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  if ! python3 -I "$HERE/w2279-check-handwritten-lyrics.py" "$f"; then
    echo "   FAIL 手写词没过闸"; echo "$wid	$lyr	词没过闸" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  if ! python3 -I "$HERE/w2280-check-lyric-labels.py" --file "$f"; then
    echo "   FAIL 段落标签闸不过(或判不了)"; echo "$wid	$lyr	标签闸" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  # 2 认旧版那一行 —— 必须唯一, 多于一条就停手(不挑"看起来对的那条")
  oldrow=$(q "SELECT id||'|'||coalesce(audio_url,'')||'|'||coalesce(subtitle_url,'')
                FROM work_language_tracks
               WHERE work_id='$wid'::uuid AND lang='$lang' AND status='ready' ORDER BY track_order, id;")
  n=$(printf '%s\n' "$oldrow" | grep -c . || true)
  if [ "$n" != "1" ]; then
    echo "   FAIL lang=$lang 的就绪轨有 $n 条, 不是 1 条 —— 不猜哪条是旧版"
    echo "$wid	$lyr	旧版轨 $n 条" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  oid=${oldrow%%|*}; rest=${oldrow#*|}; oau=${rest%%|*}; osub=${rest#*|}
  echo "   旧版轨 id=$oid  音频 …${oau: -28}"
  case "$oau" in https://*) ;; *) echo "   FAIL 旧版没有公网音频地址, 无法按音频做快照"; echo "$wid	$lyr	旧版无音频" >>"$FAILED"; fail_n=$((fail_n+1)); continue;; esac

  # 3 先把【旧版】的字幕按它自己的音频存一份并挂上 —— 必须在生成之前
  if [ -n "$osub" ]; then
    echo "   旧版已经有自己的 subtitle_url, 不动它"
  elif ! snap_for_track "$wid" "$oid" "$oau" old "$lang"; then
    echo "   FAIL 旧版字幕没保住 —— 不生成(不保住就动手正是 17 首那次的起点)"
    echo "$wid	$lyr	旧版字幕没保住" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  if [ "$APPLY" = "0" ]; then echo "   [干跑] 到此为止, 不 POST"; done_n=$((done_n+1)); continue; fi

  # 4 生成新版本(手写词 + 换一个 voice 占新槽; lang 不变)
  body=$(python3 -I -c '
import json,sys
print(json.dumps({"voices":[sys.argv[2]],"lyrics":open(sys.argv[1],encoding="utf-8").read()}))' "$f" "$VOICE")
  resp=$(curl -s -m 120 -X POST "http://127.0.0.1:3000/api/works/$wid/voice-tracks" \
    -H 'content-type: application/json' -H "x-admin-token: $CSSOS_ADMIN_TOKEN" -d "$body")
  echo "   POST $resp"
  case "$resp" in *'"ok":true'*) ;; *) echo "   FAIL POST 没成"; echo "$wid	$lyr	POST 失败: $resp" >>"$FAILED"; fail_n=$((fail_n+1)); continue;; esac

  # 5 等它就绪 —— 【光等 status=ready 是不够的】。
  #   renderLanguageTrack 里字幕生成是 fire-and-forget 的 async IIFE,
  #   它在 status='ready' 与 audio_url 落库【之后】才跑完。只等 ready 就去做快照,
  #   拿到的还是旧版那一份 —— 实测这样挂错过一次(轨 1783/1784, 已用
  #   w2281-dogwalker-fix-new-snapshot.sh 改正)。
  #   所以再加一个判据, 而且是【直接比字节】, 不猜引擎怎么渲染我的词:
  #     作品级 subtitle-take1.json 与【旧版快照那份】不同 → 新版字幕写进去了。
  #     外加下限 en 条目 ≥ 40 行(手写词 50 行正文), 防着拿到半成品。
  oldsnap=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE id=$oid;")
  oldf=/tmp/w2281/dogwalker/$wid--oldsnap.json
  if [ -n "$oldsnap" ]; then curl -s -o "$oldf" "$oldsnap" >/dev/null 2>&1 || : ; fi
  st=""; subok=0
  for i in $(seq 1 90); do
    st=$(q "SELECT status||'|'||coalesce(audio_url,'')||'|'||coalesce(alt_audio_url,'')||'|'||id
              FROM work_language_tracks WHERE work_id='$wid'::uuid AND lang='$lang' AND voice='$VOICE';")
    case "$st" in
      ready\|http*)
        curf=/tmp/w2281/dogwalker/$wid--cur.json
        if [ "$(curl -s -o "$curf" -w '%{http_code}' -A "Mozilla/5.0 (Macintosh) cssos-audit" \
              "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")" = "200" ] \
           && [ -s "$curf" ] && { [ ! -s "$oldf" ] || ! cmp -s "$curf" "$oldf"; }; then
          nl=$(python3 -I -c '
import json,sys
j=json.load(open(sys.argv[1])); lg=sys.argv[2].lower()
hit=[L for L in (j.get("languages") or []) if str(L.get("lang","")).lower().startswith(lg)]
print(sum(len(s.get("lines") or []) for s in (hit[0].get("sections") or [])) if hit else 0)
' "$curf" "$lang" 2>/dev/null || echo 0)
          if [ "${nl:-0}" -ge 40 ]; then echo "   新版字幕已写进作品级($nl 行)"; subok=1; break; fi
        fi
        ;;
      failed\|*) break;;
    esac
    sleep 20
  done
  case "$st" in
    ready\|http*) ;;
    *) echo "   FAIL 新版没就绪: $st"; echo "$wid	$lyr	新版没就绪: $st" >>"$FAILED"; fail_n=$((fail_n+1)); continue;;
  esac
  if [ "$subok" != "1" ]; then
    echo "   FAIL 音频就绪了但新版字幕一直没写进作品级 —— 这是【我没等到】, 不是【它失败了】;"
    echo "        不做快照(拿旧版那份当新版的就是 W2267 那个错)。音频与旧版字幕都在, 稍后可用"
    echo "        w2281-dogwalker-fix-new-snapshot.sh 补挂。"
    echo "$wid	$lyr	新版字幕没等到(音频已成)" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  # 6 再给【新版】挂它自己的字幕
  if ! snap_for_track "$wid" "$nid" "$nau" new "$lang"; then
    echo "   FAIL 新版字幕没挂上(旧版已保住, 不回滚)"; echo "$wid	$lyr	新版字幕没挂上" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  done_n=$((done_n+1))
done < <(cat "$PAIRS"; echo)

echo
echo "汇总: 清单 $plan · 做成 $done_n · 失败 $fail_n$([ "$APPLY" = "0" ] && echo '  [干跑]')"
if [ $((done_n+fail_n)) -ne "$plan" ]; then
  echo "FAIL: 做成+失败 = $((done_n+fail_n)) ≠ 清单 $plan —— 自己的账对不上, 上面的数不要信"; exit 1
fi
[ "$fail_n" = "0" ] || { echo "失败清单:"; cat "$FAILED"; exit 1; }
