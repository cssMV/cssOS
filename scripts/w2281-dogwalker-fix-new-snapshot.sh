#!/usr/bin/env bash
# W2281 补救 —— 新版本那两条轨的 subtitle_url 挂错了, 挂的是【旧版】那份字幕。
#
# 怎么错的: renderLanguageTrack 里字幕生成是一个 fire-and-forget 的 async IIFE,
# 它【在 status='ready' 与 audio_url 落库之后】才跑完。我的等待条件是
# 「status=ready 且有 audio_url」—— 那一刻音频在了, 字幕还没写,
# 于是我按新音频的 sha1 做快照, 快照里装的还是旧版那一份。
# 实测: 89be933b 的新轨 1783 自己的字幕是 44 行「We lift our eyes」(旧版那份),
# 而作品级已经是 50 行「Six fifteen and the street is mine」(新版那份)。
#
# 旧版那两条没错 —— 它们是生成【之前】快照的, 正是为此设计, 44 行本来就对。
#
# 判据换成【直接比字节】, 不猜引擎怎么渲染我的词:
#   作品级 subtitle-take1.json 与【旧版快照那份】不同 → 新版字幕已经写进去了。
#   再加一条下限: en 条目 ≥ 40 行(手写词 50 行正文), 防着拿到一个半成品。
#   等不到就报「我没等到」, 不报「失败」, 也绝不拿旧的顶上去。
#
# 这两个键是我几分钟前自己写的、装着错内容, 正确内容本来就该在这个地址
# (键 = 新版音频的 sha1), 所以这里是【改正】不是【覆盖别人的旧版】。
set -u
PAIRS="${1:?用法: w2281-dogwalker-fix-new-snapshot.sh <manifest.tsv> [--apply]}"
APPLY=0; [ "${2:-}" = "--apply" ] && APPLY=1
VOICE="${VOICE:-masculine}"
CUR=/srv/cssos/current
set -a; . /etc/cssos.env; set +a
: "${DATABASE_URL:?没有 DATABASE_URL}"
mkdir -p /tmp/w2281/dwfix
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }

plan=0; ok_n=0; bad_n=0
while IFS=$'\t' read -r wid lang lyr; do
  wid="$(printf '%s' "${wid:-}" | tr -d '[:space:]')"
  lang="$(printf '%s' "${lang:-}" | tr -d '[:space:]')"
  [ -n "$wid" ] || continue
  case "$wid" in \#*) continue;; esac
  plan=$((plan+1))
  echo "=== [$plan] $wid  $lang/$VOICE"

  row=$(q "SELECT id||'|'||coalesce(audio_url,'')||'|'||coalesce(subtitle_url,'')
             FROM work_language_tracks
            WHERE work_id='$wid'::uuid AND lang='$lang' AND voice='$VOICE' AND status='ready';")
  n=$(printf '%s\n' "$row" | grep -c . || true)
  [ "$n" = "1" ] || { echo "   FAIL 新版轨查到 $n 条, 不是 1 条 —— 不猜"; bad_n=$((bad_n+1)); continue; }
  nid=${row%%|*}; r2=${row#*|}; nau=${r2%%|*}; nsub=${r2#*|}

  oldrow=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks
               WHERE work_id='$wid'::uuid AND lang='$lang' AND voice='auto' AND status='ready';")
  [ -n "$oldrow" ] || { echo "   FAIL 旧版轨没有自己的 subtitle_url —— 没有基准可比, 不动"; bad_n=$((bad_n+1)); continue; }
  oldf=/tmp/w2281/dwfix/$wid--old.json
  [ "$(curl -s -o "$oldf" -w '%{http_code}' "$oldrow")" = "200" ] || { echo "   FAIL 旧版快照取不到"; bad_n=$((bad_n+1)); continue; }

  cur=/tmp/w2281/dwfix/$wid--cur.json
  got=0
  for i in $(seq 1 60); do
    code=$(curl -s -o "$cur" -w '%{http_code}' -A "Mozilla/5.0 (Macintosh) cssos-audit" \
      "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")
    if [ "$code" = "200" ] && [ -s "$cur" ] && ! cmp -s "$cur" "$oldf"; then
      ln=$(python3 -I -c '
import json,sys
j=json.load(open(sys.argv[1])); lg=sys.argv[2].lower()
hit=[L for L in (j.get("languages") or []) if str(L.get("lang","")).lower().startswith(lg)]
print(sum(len(s.get("lines") or []) for s in (hit[0].get("sections") or [])) if hit else 0)
' "$cur" "$lang" 2>/dev/null || echo 0)
      if [ "${ln:-0}" -ge 40 ]; then echo "   作品级已换成新版($ln 行)"; got=1; break; fi
      echo "   作品级变了但只有 ${ln:-0} 行 —— 像半成品, 继续等"
    fi
    sleep 15
  done
  [ "$got" = "1" ] || { echo "   FAIL 等了 15 分钟作品级还是旧版那份 —— 这是【我没等到】, 不是【它失败了】; 不拿旧的顶上"; bad_n=$((bad_n+1)); continue; }

  tag=$(printf '%s' "$nau" | sha1sum | cut -c1-10)
  key="works/$wid/subtitle-take1--a$tag.json"
  url="https://cdn.cssstudio.app/$key"
  if [ -n "$nsub" ] && [ "$nsub" != "$url" ]; then
    echo "   FAIL 新版轨已挂的是 $nsub, 与按新音频算出的 $url 不一致 —— 不动"; bad_n=$((bad_n+1)); continue
  fi
  if [ "$APPLY" = "0" ]; then echo "   [干跑] 会把 $key 改正成新版那份, 并确保轨 $nid 指向它"; ok_n=$((ok_n+1)); continue; fi

  put=$( cd "$CUR" && node r2putkey.mjs "$cur" "$key" "application/json" 2>/dev/null | tail -1 )
  case "$put" in *'"ok":true'*) ;; *) echo "   FAIL 推 R2 失败: $put"; bad_n=$((bad_n+1)); continue;; esac
  q "UPDATE work_language_tracks SET subtitle_url='$url', updated_at=now() WHERE id=$nid;" >/dev/null
  # 回读: 库里指向它, 且取下来的字节与作品级新版一致, 且与旧版那份不同
  back=$(q "SELECT coalesce(subtitle_url,'') FROM work_language_tracks WHERE id=$nid;")
  [ "$back" = "$url" ] || { echo "   FAIL 回读库里是 '$back'"; bad_n=$((bad_n+1)); continue; }
  chk=/tmp/w2281/dwfix/$wid--back.json
  [ "$(curl -s -o "$chk" -w '%{http_code}' "$url?cb=$(date +%s)-$RANDOM")" = "200" ] || { echo "   FAIL 回读 URL 不是 200"; bad_n=$((bad_n+1)); continue; }
  cmp -s "$chk" "$cur" || { echo "   FAIL 回读字节与作品级新版不一致"; bad_n=$((bad_n+1)); continue; }
  cmp -s "$chk" "$oldf" && { echo "   FAIL 回读字节与【旧版】相同 —— 还是挂错了"; bad_n=$((bad_n+1)); continue; }
  echo "   OK 轨 $nid 现在挂的是新版那份 $key"
  ok_n=$((ok_n+1))
done < <(cat "$PAIRS"; echo)

echo
echo "汇总: 清单 $plan · 改正 $ok_n · 不过 $bad_n$([ "$APPLY" = "0" ] && echo '  [干跑]')"
[ $((ok_n+bad_n)) -eq "$plan" ] || { echo "FAIL: 改正+不过 ≠ 清单 —— 自己的账对不上"; exit 1; }
[ "$bad_n" = "0" ] || exit 1
