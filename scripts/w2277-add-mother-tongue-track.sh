#!/bin/bash
# W2277 —— 给一个作品新增一条【母语】语言轨。串行, 一首一首。
#
# Jing 2026-11-07:「同意，先5首跑通再放量。」
# Jing 既有常驻:「以后先不要几路并发了，我们不急，要稳，准，狠！一个一个来也不错。」
#
# 走平台自己的 POST /api/works/:id/language-tracks(admin token), 不另造管线:
#   转译(或原词直唱) → Suno 出 ♪1/♪2 → persistRemoteAudioToStable 落我们域名(内容哈希名)
#   → 强制对齐 → 情绪字幕 → upsertSubtitleJson(只替换该语言那一条, 其余语言原样)
# 全程【新增一行轨】, 中文那条一个 token 不动 —— 这是 Jing 的版本铁律:
#   「新旧版本允许同时存在, 让用户可以在多声线胶囊那里选择, 而不是覆盖掉。」
#
# ⚠ 三个会让人得出假结论的坑, 2026-11-08 这一轮各栽了一次:
#
#   1「轨 ready」≠「字幕写完」。renderLanguageTrack 的字幕那一段是 setStatus("ready")
#     【之后】才 fire-and-forget 跑的(情绪标注 + ♪1/♪2 各自强制对齐 + 音频富集),
#     实测还要十几分钟。只等 ready 就收工 → 批量里会留下一批【有音频没字幕】的轨,
#     正是我们一直在补的那种洞。所以 watch 两头都等。
#
#   2 取 CDN 必须带【唯一】cache-buster。固定的 ?t=xxx 在写入前取过一次就被缓存住。
#
#   3 判据抄平台只抄一半 = 造了一份新的(段落标记要认 `[` 和全角 `【` `〔` 三种)。
#
# 用法(在 api-vm 上跑):
#   bash w2277-add-mother-tongue-track.sh <workId> <lang> [--sing-preview]
#
#   --sing-preview = A 类专用: 不转译, 把 lyrics_preview 原词直唱(W2130 lyricsOverride)。
#     只给【母语词已经写好、只是从没被唱过】的作品用 —— 再找 LLM 写一遍是浪费, 且有改写风险。
#     首例 Athena: 唱出来的词与原希腊词【逐字节一致】(3311/3311)。
set -euo pipefail
set -a; . /etc/cssos.env 2>/dev/null; set +a
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
wid="${1:?用法: $0 <workId> <lang> [--sing-preview]}"
lang="${2:?缺 lang}"
sing="${3:-}"

[ -n "${CSSOS_ADMIN_TOKEN:-}" ] || { echo "FAIL: 没有 CSSOS_ADMIN_TOKEN"; exit 1; }

title=$(psql "$DATABASE_URL" -X -q -t -A -c "select coalesce(title,'') from user_works where id='$wid'::uuid")
[ -n "$title" ] || { echo "FAIL: 查不到作品 $wid —— work_id 只能查不能想"; exit 1; }

body="{\"languages\":[\"$lang\"],\"source_lang\":\"zh\"}"
if [ "$sing" = "--sing-preview" ]; then
  # 原词直唱前先量行数 —— 够不上 10节/40行 的完整度铁律就别唱, 唱出来也是半成品
  n=$(psql "$DATABASE_URL" -X -q -t -A -c "select count(*) from (select unnest(string_to_array(btrim(coalesce(lyrics_preview,'')), chr(10))) l from user_works where id='$wid'::uuid) t where btrim(l) <> ''")
  [ "$n" -ge 40 ] || { echo "FAIL: lyrics_preview 只有 $n 个非空行 (<40) —— 够不上完整度铁律, 别唱"; exit 1; }
  echo "原词直唱: $n 个非空行"
  body=$(psql "$DATABASE_URL" -X -q -t -A -c "select json_build_object('languages',json_build_array('$lang'),'source_lang','zh','lyrics',coalesce(lyrics_preview,''))::text from user_works where id='$wid'::uuid")
fi

echo "=== ${wid:0:8} $title → $lang ${sing:+[原词直唱]}"

# ── 先落备份, 再动手(W2086: 入库 R2 ≠ 保住旧版; 而「不备份就动手」是那 17 首的起点)──
#    核对器拿【R2 上这份改前原件】当基准 —— 不是拿库里的当前值比当前值(那是同义反复)。
#    备份不成就不许生成: 没有基准的「核对通过」毫无意义。
mkdir -p /tmp/w2277-pre
pre="/tmp/w2277-pre/$wid--take1-pre.json"
code=$(curl -s -o "$pre" -w "%{http_code}" -A "Mozilla/5.0 (Macintosh) cssos-audit" \
  "https://cdn.cssstudio.app/works/$wid/subtitle-take1.json?cb=$(date +%s)-$RANDOM")
if [ "$code" = "200" ] && [ -s "$pre" ]; then
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$pre" \
    || { echo "FAIL: 改前字幕不是合法 JSON, 不动手"; exit 1; }
  ( cd /srv/cssos/current && node r2putkey.mjs "$pre" \
      "artifacts/audit/w2277/$wid--subtitle-take1-pre.json" "application/json" >/dev/null ) \
    || { echo "FAIL: 改前原件推 R2 失败, 不动手"; exit 1; }
  echo "改前字幕已备份($(stat -c %s "$pre")B → R2 artifacts/audit/w2277/)"
elif [ "$code" = "404" ]; then
  echo "改前没有字幕文件(http 404)—— 这一首是从零加第一条字幕, 没有基准可比"
  rm -f "$pre"
else
  echo "FAIL: 取改前字幕 http=$code —— 【取不到】和【没有】不是一回事, 不猜, 不动手"; exit 1
fi
psql "$DATABASE_URL" -X -q -c "
  create table if not exists w2277_pre_backup as select now() as backed_up_at, w.* from user_works w where false;
  create table if not exists w2277_pre_tracks as select now() as backed_up_at, lt.* from work_language_tracks lt where false;
  insert into w2277_pre_backup select now(), w.* from user_works w where w.id='$wid'::uuid;
  insert into w2277_pre_tracks select now(), lt.* from work_language_tracks lt where lt.work_id='$wid'::uuid;" \
  >/dev/null || { echo "FAIL: 库备份失败, 不动手"; exit 1; }
echo "库备份已落(w2277_pre_backup / w2277_pre_tracks)"

resp=$(curl -s --max-time 60 -X POST "http://127.0.0.1:3000/api/works/$wid/language-tracks" \
  -H "Content-Type: application/json" -H "x-admin-token: $CSSOS_ADMIN_TOKEN" -d "$body")
echo "POST $resp"
case "$resp" in *'"ok":true'*) ;; *) echo "FAIL: 没入队"; exit 1;; esac

# 两头都等: 轨 ready + 字幕文件里真的出现这个语言
bash "$HERE/w2277-watch-track.sh" "$wid" "$lang"
log="/tmp/w2277-watch-${wid:0:8}-$lang.log"; tail -3 "$log"
grep -q "DONE ready+subtitle" "$log" || { echo "FAIL: 没等到 ready+字幕, 见 $log"; exit 1; }

echo "--- 核对词 ---"; python3 -I "$HERE/w2277-check-track-lyrics.py" "$wid" "$lang"
echo "--- 核对字幕是纯增加 ---"; python3 -I "$HERE/w2277-verify-subtitle-additive.py" "$wid" "$lang"
echo "DONE ${wid:0:8} $lang"
