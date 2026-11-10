#!/usr/bin/env bash
# W2285 —— 125 首作品的「原版」是一段 30/60 秒占位音, 把母语轨补成真音乐。
#
# 事实(2026-11-09 实测, 不是推测):
#   · 125 条轨的 audio_url 在 artifacts/mv-fallback/ 下, 时长只有两种:
#     30 秒 47 条、60 秒 78 条, 全建于 2026-06-04 同一批 —— 没有一条是真音乐。
#     (artifacts/mv-fallback/ 本来是【封面】的兜底目录, 一个 audio-*.mp3 躺在里面,
#      本身就说明它是兜底路径写出来的占位物。)
#   · 125 条全是该作品的 is_default 轨(= 母语轨), 作品一律 status=draft 但 visibility=public。
#   · 125 首的 preview_audio_url 也是同一段占位音 —— 所以用户现在听到的就是它。
#   · 125 首的歌词都在(602–1884 字符), 两道既有闸门全过: W2278 串台 0 · W2280 裸标签 0。
#   · 125 段占位音【已经登记成 work_media_versions 版本行】(带时长), 字节本来就有自己的地址。
#   · 112 首除此之外没有任何真音轨; 13 首另有一条真的 en 轨(贝多芬是其中一首)。
#
# 为什么是【覆盖这一行】而不是【另起一条轨】:
#   版本铁律写得清楚: 半成品 / 空 / 生成失败可以覆盖, 已完整的才只准新起版本。
#   30 秒占位音是半成品。而要让用户真的听到真音乐, 真音乐必须落在【母语轨本身】——
#   另起一条声线轨会让 is_default 仍然停在占位音上(W439: is_default 跟母语/track_order 走,
#   不跟谁先完成走), preview_audio_url 也还是占位音, 等于白做。
#   旧字节一个也不丢: 它已经是版本行, 这里再把整行连同 preview_audio_url 存进
#   w2285_placeholder_backup, 任何一步出错都【原样还原】。
#
# 怎么让一条 ready 的轨重新生成: 不加新开关, 用现成那条路 ——
#   W2277 的判据是「failed 且 audio_url/alt_audio_url 都空 → 真空失败, 放行重试」。
#   所以先备份、再把这一行翻成那个形状, 然后照常 POST /api/works/:id/language-tracks。
#   顺带的好处: 翻过去之后 coverSrc 查不到 is_default+ready+有音频 的轨 → coverOk=false
#   → 自然走 generate 而不是 upload-cover(贝多芬两次 15 分钟超时正是 cover 占位音卡死的)。
#
# 用法: bash w2285-replace-placeholder-music.sh <manifest.tsv> [--apply]
#   清单每行两列: <workId> <TAB> <lang>   (用 --make-manifest 可现查现生成)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CUR=/srv/cssos/current
set -a; . /etc/cssos.env; set +a
: "${DATABASE_URL:?没有 DATABASE_URL}"
: "${CSSOS_ADMIN_TOKEN:?没有 CSSOS_ADMIN_TOKEN}"

q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }
# W2290: 写操作专用 —— q() 不看返回码(读取时那样是对的), 但一条写 SQL 在 `set -e`
# 下失败会打断整批(实测 1 个重复键换 72 首不跑)。qx() 返回码可判, 调用点自己决定,
# 真错误落进 $QXERR 而不是消失(静默分支正是 W2286 的病根)。
QXERR=/tmp/w2285.qxerr
qx() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>>"$QXERR"; }

# ── --make-manifest: 现查现生成清单, 顺带标出歌词够不够 10 节 40 行 ──────────
if [ "${1:-}" = "--make-manifest" ]; then
  out="${2:-/tmp/w2285/manifest-all.tsv}"; mkdir -p "$(dirname "$out")"
  q "SELECT lt.work_id::text||chr(9)||lt.lang
       FROM work_language_tracks lt
      WHERE lt.audio_url LIKE '%/artifacts/mv-fallback/%'
        AND lt.is_default = true AND lt.status = 'ready'
      ORDER BY lt.work_id" > "$out"
  echo "清单已写 $out ($(grep -c . "$out") 行)"
  exit 0
fi

MAN="${1:?用法: w2285-replace-placeholder-music.sh <manifest.tsv> [--apply]}"
APPLY=0; [ "${2:-}" = "--apply" ] && APPLY=1
ALLOW_SHORT=0; case " $* " in *" --allow-short "*) ALLOW_SHORT=1;; esac
MINDUR="${MINDUR:-120}"      # 成品时长下限: 低于它就是歌词短了的免费探针
# 认「要被替换的那一版」的条件。默认只认占位音目录; 需要重做某一条已生成的轨时
# (例如先导那首被转译改写了词), 用 SRC_LIKE 指到它自己的 URL 上, 而不是给脚本加后门。
SRC_LIKE="${SRC_LIKE:-%/artifacts/mv-fallback/%}"
FAILED=/tmp/w2285.failed
mkdir -p /tmp/w2285; : > "$FAILED"; : > "$QXERR"

# 备份表(只增不改)
psql "$DATABASE_URL" -X -q <<'PSQL' >/dev/null
CREATE TABLE IF NOT EXISTS w2285_placeholder_backup (
  backed_up_at    timestamptz NOT NULL DEFAULT now(),
  track_id        bigint      NOT NULL,
  work_id         uuid        NOT NULL,
  lang            text        NOT NULL,
  voice           text        NOT NULL,
  old_status      text,
  old_audio_url   text,
  old_duration    integer,
  old_alt_url     text,
  old_alt_duration integer,
  old_subtitle_url text,
  old_preview_audio_url text,
  old_work_duration integer
);
PSQL

plan=0; done_n=0; skip_n=0; fail_n=0

restore() {   # $1=track_id —— 任何一步出错都把这一行原样还原, 绝不把作品留在更差的状态
  local tid="$1"
  q "UPDATE work_language_tracks t SET
        status = b.old_status, audio_url = b.old_audio_url, duration_secs = b.old_duration,
        alt_audio_url = b.old_alt_url, alt_duration_secs = b.old_alt_duration,
        subtitle_url = b.old_subtitle_url, updated_at = now()
      FROM (SELECT * FROM w2285_placeholder_backup WHERE track_id=$tid
             ORDER BY backed_up_at DESC LIMIT 1) b
      WHERE t.id = $tid;" >/dev/null
  q "UPDATE user_works w SET preview_audio_url = b.old_preview_audio_url,
        duration_secs = b.old_work_duration, updated_at = now()
      FROM (SELECT * FROM w2285_placeholder_backup WHERE track_id=$tid
             ORDER BY backed_up_at DESC LIMIT 1) b
      WHERE w.id = b.work_id;" >/dev/null
  local back; back=$(q "SELECT status||'|'||coalesce(audio_url,'') FROM work_language_tracks WHERE id=$tid;")
  echo "   已还原: $back"
}

# ── W2286 余额闸门 ──────────────────────────────────────────────────────────
# 为什么必须有: 2026-11-09 这一批跑到第 77 首时 KIE 余额归零, 之后【19 首连续全败】,
# 每首还连发 5 次注定被拒的调用, 而且 journald 里一行原因都没有(见 src/index.ts W2286)。
# 代码侧已经修成「余额错不重试 + 喊出来」, 但更该省的是【根本不要开跑】——
# 余额见底时这个脚本能做的唯一正确的事就是停下来叫人充值, 不是把 125 首逐个撞一遍墙。
#
# 判据取【响应体的 code / data】, 不看 HTTP 状态 —— KIE 一律回 200(这正是 W2286 的坑)。
# 取不到余额时【不许当成有钱】: 这是「判不了」, 不是「够」。
# 【W2290 实测校正】一首不是 2 个 credit, 是约 14 个(2026-11-10 逐首量: 984.70 起,
# 每首掉 13.9~14.1)。下限写 3 等于没有闸门 —— 余额 10 时它照样放行, 然后 KIE 回 402,
# 这一首走「POST 没成/没就绪 → 还原」。不会弄坏东西, 但白跑一轮、日志上多一条假失败。
# 下限要【够做完一首】才有意义, 所以取 15。
KIE_FLOOR=${KIE_FLOOR:-15}         # 低于这个数就不开跑(实测一首约 14 个 credit)
kie_credit() {
  local key json code
  key=$(grep -m1 '^KIE_API_KEY=' /etc/cssos.env | cut -d= -f2- | tr -d '"'"'"'')
  [ -n "$key" ] || { echo "NOKEY"; return; }
  json=$(curl -s -m 20 -H "Authorization: Bearer $key" https://api.kie.ai/api/v1/chat/credit)
  code=$(printf '%s' "$json" | sed -n 's/.*"code":[[:space:]]*\([0-9-]*\).*/\1/p')
  [ "$code" = "200" ] || { echo "ERR:$(printf '%s' "$json" | head -c 100)"; return; }
  printf '%s' "$json" | sed -n 's/.*"data":[[:space:]]*\(-\?[0-9.]*\).*/\1/p'
}
credit_gate() {                     # 返回 0 = 可以继续
  local c; c=$(kie_credit)
  case "$c" in
    ''|NOKEY|ERR:*) echo "⛔ 余额查不到($c)——【这是判不了, 不是够】, 停手"; return 1;;
  esac
  if awk -v c="$c" -v f="$KIE_FLOOR" 'BEGIN{exit !(c+0 < f+0)}'; then
    echo "⛔ KIE 余额 $c < 下限 $KIE_FLOOR —— 停手, 请先充值(只在 KIE 一处充)"; return 1
  fi
  echo "   KIE 余额 $c  (下限 $KIE_FLOOR)"; return 0
}
credit_gate || exit 2

while IFS=$'\t' read -r wid lang; do
  wid="$(printf '%s' "${wid:-}" | tr -d '[:space:]')"
  lang="$(printf '%s' "${lang:-}" | tr -d '[:space:]')"
  [ -n "$wid" ] || continue
  case "$wid" in \#*) continue;; esac
  plan=$((plan+1))
  title=$(q "SELECT left(coalesce(title,''),26) FROM user_works WHERE id='$wid'::uuid;")
  echo "=== [$plan] $wid  $lang  $title"

  # ── 1 这一行真的是占位音吗 —— 不是就不动(别拿别的轨当占位音) ──────────────
  row=$(q "SELECT id||'|'||status||'|'||coalesce(audio_url,'')||'|'||coalesce(duration_secs,0)
             FROM work_language_tracks
            WHERE work_id='$wid'::uuid AND lang='$lang' AND is_default=true
              AND status='ready' AND audio_url LIKE '$SRC_LIKE';")
  n=$(printf '%s\n' "$row" | grep -c . || true)
  if [ "$n" != "1" ]; then
    echo "   SKIP 符合「母语轨+ready+音频 LIKE $SRC_LIKE」的行有 $n 条, 不是 1 条 —— 不猜"
    echo "$wid	$lang	占位轨 $n 条" >>"$FAILED"; skip_n=$((skip_n+1)); continue
  fi
  tid=${row%%|*}; r2=${row#*|}; ost=${r2%%|*}; r3=${r2#*|}; oau=${r3%%|*}; odur=${r3#*|}
  echo "   占位轨 id=$tid  ${odur}s  …${oau: -34}"

  # ── 2 歌词先过三道闸(完整度 + 串台 + 裸标签), 不过就不花钱 ────────────────
  lyr=/tmp/w2285/$wid--lyrics.txt
  q "SELECT coalesce(lyrics_preview,'') FROM user_works WHERE id='$wid'::uuid;" > "$lyr"
  set +e
  python3 -I - "$lyr" "$ALLOW_SHORT" <<'PYGATE'
import re, sys
t = open(sys.argv[1], encoding="utf-8").read()
allow_short = sys.argv[2] == "1"
lines = [x.strip() for x in t.split("\n") if x.strip()]
SEC = re.compile(r"^\[(Verse|Chorus|Bridge|Outro|Intro|Pre-Chorus|Hook|Refrain)\b", re.I)
secs = [x for x in lines if SEC.match(x)]
body = [x for x in lines if not x.startswith(("[", "【", "〔"))]
print(f"   歌词 {len(secs)} 节 · {len(body)} 行")
if len(secs) < 10 or len(body) < 40:
    msg = f"歌词不完整({len(secs)} 节 / {len(body)} 行, 铁律要 ≥10 节且 ≥40 行)"
    if not allow_short:
        sys.exit("   FAIL " + msg + " —— 短词只会生成出短歌, 不花这个钱(要硬上请加 --allow-short)")
    print("   ⚠ " + msg + " —— --allow-short 已放行, 成品很可能偏短")
PYGATE
  g1=$?; set -e
  if [ "$g1" != "0" ]; then echo "$wid	$lang	歌词不完整" >>"$FAILED"; skip_n=$((skip_n+1)); continue; fi
  set +e; python3 -I "$HERE/w2278-check-work-lyric-clean.py" "$wid" >/dev/null 2>&1; g2=$?
  python3 -I "$HERE/w2280-check-lyric-labels.py" "$wid" >/dev/null 2>&1; g3=$?; set -e
  if [ "$g2" != "0" ] || [ "$g3" != "0" ]; then
    echo "   SKIP 串台闸 rc=$g2 / 标签闸 rc=$g3 —— 判不了也不许过"
    echo "$wid	$lang	闸门 $g2/$g3" >>"$FAILED"; skip_n=$((skip_n+1)); continue
  fi

  if [ "$APPLY" = "0" ]; then echo "   [干跑] 会备份 → 翻成可重试 → POST $lang → 回填 preview"; done_n=$((done_n+1)); continue; fi

  # ── 3 备份: 整行 + 作品那两列。备不进去就不动手 ──────────────────────────
  q "INSERT INTO w2285_placeholder_backup
       (track_id, work_id, lang, voice, old_status, old_audio_url, old_duration,
        old_alt_url, old_alt_duration, old_subtitle_url, old_preview_audio_url, old_work_duration)
     SELECT t.id, t.work_id, t.lang, t.voice, t.status, t.audio_url, t.duration_secs,
            t.alt_audio_url, t.alt_duration_secs, t.subtitle_url, w.preview_audio_url, w.duration_secs
       FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id WHERE t.id=$tid;" >/dev/null
  bk=$(q "SELECT count(*) FROM w2285_placeholder_backup WHERE track_id=$tid;")
  if [ "${bk:-0}" -lt 1 ]; then
    echo "   FAIL 备份没落进去 —— 不动手(「不备份就动手」正是那 17 首的起点)"
    echo "$wid	$lang	备份失败" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  # 占位音必须已经是版本行, 否则翻掉这一行之后旧字节就没人指向了
  hv=$(q "SELECT count(*) FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND url='$oau';")
  if [ "${hv:-0}" -lt 1 ]; then
    echo "   旧版还不是版本行, 先登记(照 registerMediaVersion 的 SQL)"
    q "INSERT INTO work_media_versions
         (work_id, kind, lang, version_no, label, url, subtitle_url, duration_secs, is_current)
       SELECT '$wid'::uuid,'audio','$lang',
              COALESCE((SELECT max(version_no) FROM work_media_versions
                         WHERE work_id='$wid'::uuid AND kind='audio'
                           AND COALESCE(lang,'')=COALESCE('$lang','')),0)+1,
              '旧版(被替换前)','$oau',NULL,$odur,false
       ON CONFLICT DO NOTHING;" >/dev/null
    hv=$(q "SELECT count(*) FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$oau';")
    [ "${hv:-0}" -ge 1 ] || { echo "   FAIL 登记不上版本行 —— 不动手"; echo "$wid	$lang	版本行登记失败" >>"$FAILED"; fail_n=$((fail_n+1)); continue; }
  fi
  # 旧字节还取得到吗(版本行指向空气就等于没保住)
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$oau")" != "200" ]; then
    echo "   FAIL 占位音现在取不到(非 200)—— 这是【取不到】不是【没有】, 停手不动"
    echo "$wid	$lang	旧字节取不到" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  # ── 4 翻成「真空失败」形状(带 audio_url 二次匹配) ──────────────────────
  q "UPDATE work_language_tracks SET status='failed', audio_url=NULL, duration_secs=NULL,
        alt_audio_url=NULL, alt_duration_secs=NULL, subtitle_url=NULL, updated_at=now()
      WHERE id=$tid AND audio_url='$oau';" >/dev/null
  chk=$(q "SELECT status||'|'||coalesce(audio_url,'(空)') FROM work_language_tracks WHERE id=$tid;")
  if [ "$chk" != "failed|(空)" ]; then
    echo "   FAIL 翻不过去(现在是 $chk) —— 还原"; restore "$tid"
    echo "$wid	$lang	翻 failed 失败" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  # ── 5 照常生成(走的是 generate, 因为此刻已没有 ready 的默认轨可当 cover 源)──
  # ⚠ 必须带上 lyrics(W2130 的 lyricsOverride, admin + 单语言才生效)——
  #   先导那一首没带, 结果 transcreateLyrics 在【zh → zh】上照样跑了一遍, 把 52 行词
  #   整首改写: 原词「在寂静的夜晚, 我聆听古人的话语」变成「长夜无声, 我翻开泛黄的篇章」,
  #   52 行里 0 行与原词相同。成因是本脚本第 4 步把母语轨翻成 failed, 于是路由里
  #   `default_lang` 查不到 ready 的默认轨 → fromLangHint 为空 → 被当成「要转译」。
  #   这一波的指令是【把占位音补成真音乐】, 不是改词。带 lyrics 就整条跳过转译, 原词直唱。
  body=$(python3 -I -c '
import json,sys
print(json.dumps({"languages":[sys.argv[2]],"lyrics":open(sys.argv[1],encoding="utf-8").read()}))' "$lyr" "$lang")
  # W2286 —— 每一次【花钱之前】都再查一次余额。一次免费查询 ~0.2s, 换掉的是
  #   「余额中途见底, 后面每一首都白撞一遍墙」。上一批正是这样连败 19 首。
  if ! credit_gate; then
    echo "   余额中途见底 —— 本批就停在这里, 剩下的一首都不动(还原本首)"
    restore "$tid"
    echo "$wid	$lang	余额见底, 未尝试" >>"$FAILED"; fail_n=$((fail_n+1))
    echo "⛔ 批次提前结束: KIE 余额不足。充值后原清单可直接重跑 —— 已做成的会被「不是占位音」那一关跳过。"
    break
  fi
  resp=$(curl -s -m 120 -X POST "http://127.0.0.1:3000/api/works/$wid/language-tracks" \
    -H 'content-type: application/json' -H "x-admin-token: $CSSOS_ADMIN_TOKEN" \
    -d "$body")
  echo "   POST $resp"
  case "$resp" in *'"ok":true'*) ;; *)
    echo "   FAIL POST 没成 —— 还原"; restore "$tid"
    echo "$wid	$lang	POST 失败: $resp" >>"$FAILED"; fail_n=$((fail_n+1)); continue;;
  esac

  # ── 6 等就绪(上限 ~30 分钟; 等不到就还原) ─────────────────────────────
  st=""
  for i in $(seq 1 90); do
    st=$(q "SELECT status||'|'||coalesce(audio_url,'')||'|'||coalesce(duration_secs,0)||'|'||coalesce(alt_audio_url,'')||'|'||coalesce(alt_duration_secs,0)
              FROM work_language_tracks WHERE id=$tid;")
    case "$st" in ready\|http*) break;; failed\|*) break;; esac
    sleep 20
  done
  case "$st" in
    ready\|http*) ;;
    *) echo "   FAIL 没就绪($st) —— 还原"; restore "$tid"
       echo "$wid	$lang	没就绪: $st" >>"$FAILED"; fail_n=$((fail_n+1)); continue;;
  esac
  nau=$(printf '%s' "$st" | cut -d'|' -f2); ndur=$(printf '%s' "$st" | cut -d'|' -f3)
  nalt=$(printf '%s' "$st" | cut -d'|' -f4); naltd=$(printf '%s' "$st" | cut -d'|' -f5)
  echo "   新音乐 ♪1 ${ndur}s ♪2 ${naltd:-0}s  …${nau: -30}"

  # ── 7 验收: 域名 / 时长下限 / 不许还是占位音 ────────────────────────────
  bad=""
  case "$nau" in https://cdn.cssstudio.app/*) ;; *) bad="$bad 新音频不在我们域名";; esac
  case "$nau" in *mv-fallback*) bad="$bad 新音频还是 mv-fallback 占位物";; esac
  # 【W2290】ndur 是 0 / 空 时, 绝不许直接判「成品短」—— 那是把【量不到】当成【没有】。
  # 实测(鲁米 2207fb38, 2026-11-10): 轨的 duration_secs 读出来是 0, 而同一刻版本行里
  # W2272 那个 ffprobe 已经量到 ♪1=234s、♪2=290s —— 一首真做好的歌被按 0s 判死、
  # 还原成 60s 占位音, 12 credit 花了, 东西扔了。Suno 有时就是不回 ♪1 的时长。
  # 所以先去量: 版本行里同 URL 的实测值 → 还不行就当场 ffprobe; 量到就回填轨那一列。
  if [ "${ndur:-0}" -le 0 ]; then
    mdur=$(q "SELECT coalesce(max(duration_secs),0) FROM work_media_versions
               WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';")
    if [ "${mdur:-0}" -le 0 ]; then
      mdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$nau" 2>/dev/null \
             | awk '{printf "%d", $1+0.5}')
    fi
    if [ "${mdur:-0}" -gt 0 ]; then
      echo "   轨的时长列是空的, 实测得 ${mdur}s —— 按实测判(【量不到】不是【短】)"
      ndur="$mdur"
      set +e
      qx "UPDATE work_language_tracks SET duration_secs=$ndur
           WHERE id=$tid AND coalesce(duration_secs,0)<=0;" || true
      set -e
    else
      echo "   ⚠ 轨的时长列是空的, 版本行与 ffprobe 都量不到 —— 这是【判不了】"
    fi
  fi
  [ "${ndur:-0}" -ge "$MINDUR" ] || bad="$bad 成品只有 ${ndur}s < ${MINDUR}s(歌词短了的免费探针)"
  # 唱的还是原词吗 —— 这一条专防转译偷偷跑(先导就是这么被改掉 52 行的)
  set +e
  same=$(python3 -I - <<PYSAME
import subprocess
r = subprocess.run(["psql", "$DATABASE_URL", "-X", "-q", "-t", "-A", "-c",
  "SELECT replace(coalesce(lt.lyrics,''),chr(10),'~NL~')||chr(1)||"
  "replace(coalesce(w.lyrics_preview,''),chr(10),'~NL~') "
  "FROM work_language_tracks lt JOIN user_works w ON w.id=lt.work_id WHERE lt.id=$tid"],
  capture_output=True, text=True)
tl, wl = (r.stdout.strip().split(chr(1), 1) + [""])[:2]
def body(t):
    return [x.strip() for x in t.replace("~NL~", chr(10)).split(chr(10))
            if x.strip() and not x.strip().startswith(("[", "\u3010"))]
b, a = body(tl), set(body(wl))
print(0 if not b else round(100 * sum(1 for x in b if x in a) / len(b)))
PYSAME
)
  set -e
  [ "${same:-0}" -ge 80 ] || bad="$bad 唱的词与作品原词只重合 ${same:-0}% —— 转译把词改了"
  if [ -n "$bad" ]; then
    echo "   FAIL 验收不过:$bad —— 还原"; restore "$tid"
    echo "$wid	$lang	验收不过:$bad" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  # ── 8 新音乐的版本行 ───────────────────────────────────────────────────
  # 【W2290 改写 —— 原来这里是一条无条件 INSERT, 它在 2026-11-10 把整个批次打断了】
  #
  # 当天早些时候 W2287 给 renderLanguageTrack 补上了 registerMediaVersion ——
  # 也就是说【♪1/♪2 的版本行现在由 Node 那一侧自己登记, 各带自己的 subtitle_url】。
  # 于是这里那条 INSERT 变成了【重复登记同一个 URL】, 而 wmv_reject_shared_url_trg
  # 是 BEFORE INSERT 触发器: 它在 ON CONFLICT 之前就 RAISE, ON CONFLICT DO NOTHING
  # 吞不掉, psql 返回非零, 上面那句 `set -e` 当场把整批打断。
  # 实测后果: 秦始皇(第 1 首)音乐做好了, 批次 rc=1 停住, 剩下 72 首一首没跑。
  #
  # 两个教训, 都记在这里:
  #   · 改了「谁负责登记」的闸门, 必须回头复核【所有假定它不存在的调用点】。
  #     那一行的原注释写着「renderLanguageTrack 这条路不登记」—— 当天已经不成立了。
  #   · `set -e` 下的一条写 SQL = 整批的单点故障。1 个重复键换 72 首不跑。
  #     所以验收之后的写操作一律改走 qx()(看返回码, 只判这一首, 不连坐)。
  #
  # 现在的做法: 先看版本行有没有, 【没有才插】; 清旧 current 也挪进真要插的那一支 ——
  # 原来是无条件先清, 插入一失败就留下「一行 current 都没有」的作品(秦始皇正是这样)。
  set +e
  hasnew=$(q "SELECT count(*) FROM work_media_versions
               WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';")
  vrc=0
  if [ "${hasnew:-0}" -ge 1 ]; then
    echo "   版本行已由 renderLanguageTrack 登记(W2287) —— 这里只校正 current 与时长"
    qx "UPDATE work_media_versions SET is_current=false
         WHERE work_id='$wid'::uuid AND kind='audio' AND is_current AND url<>'$nau';" || vrc=1
    qx "UPDATE work_media_versions SET is_current=true
         WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';" || vrc=1
    qx "UPDATE work_media_versions SET duration_secs=$ndur
         WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau'
           AND duration_secs IS NULL;" || vrc=1
  else
    qx "UPDATE work_media_versions SET is_current=false
         WHERE work_id='$wid'::uuid AND kind='audio' AND is_current;" || vrc=1
    qx "INSERT INTO work_media_versions
         (work_id, kind, lang, version_no, label, url, subtitle_url, duration_secs, is_current)
       SELECT '$wid'::uuid,'audio','$lang',
              COALESCE((SELECT max(version_no) FROM work_media_versions
                         WHERE work_id='$wid'::uuid AND kind='audio'
                           AND COALESCE(lang,'')=COALESCE('$lang','')),0)+1,
              'W2285 真音乐','$nau',
              (SELECT subtitle_url FROM work_language_tracks WHERE id=$tid),$ndur,true
       ON CONFLICT DO NOTHING;" || vrc=1
  fi
  vn=$(q "SELECT count(*) FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';")
  cn=$(q "SELECT count(*) FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau' AND is_current;")
  set -e
  if [ "$vrc" != "0" ] || [ "${cn:-0}" -lt 1 ]; then
    echo "   ⚠ 版本行写入报错(vrc=$vrc)或新音乐没成为 current(cn=${cn:-0}) —— 音乐本身没问题"
    echo "$wid	$lang	版本行 vrc=$vrc current=${cn:-0} (详见 $QXERR)" >>"$FAILED"
    fail_n=$((fail_n+1)); continue
  fi
  if [ "${vn:-0}" -lt 1 ]; then
    echo "   ⚠ 新音乐没登记成版本行 —— 音乐本身没问题, 但它不会出现在版本胶囊里"
    echo "$wid	$lang	新音乐未登记版本行" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi

  # ── 9 作品那两列指向新音乐(旧值在备份里) ───────────────────────────────
  set +e
  qx "UPDATE user_works SET preview_audio_url='$nau', duration_secs=$ndur, updated_at=now()
       WHERE id='$wid'::uuid AND preview_audio_url='$oau';" || true
  set -e
  pv=$(q "SELECT coalesce(preview_audio_url,'') FROM user_works WHERE id='$wid'::uuid;")
  if [ "$pv" != "$nau" ]; then
    echo "   ⚠ preview_audio_url 回读是 '…${pv: -30}' 不是新音频 —— 轨已是真音乐, 但首页仍播旧的"
    echo "$wid	$lang	preview 没换过来" >>"$FAILED"; fail_n=$((fail_n+1)); continue
  fi
  # 字幕是 fire-and-forget 的后半段(whisperx 对齐 + 情绪标注, 实测还要两三分钟),
  # ready 的那一刻它一定还没写完。给一段有界的等待; 等不到只报出来, 不算这一首失败
  # ——【我没等到】与【它没生成】是两件事。
  sub="(空)"
  for i in $(seq 1 24); do
    sub=$(q "SELECT coalesce(subtitle_url,'(空)') FROM work_language_tracks WHERE id=$tid;")
    [ "$sub" != "(空)" ] && break
    sleep 15
  done
  if [ "$sub" != "(空)" ]; then
    set +e
    qx "UPDATE work_media_versions SET subtitle_url='$sub'
         WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau'
           AND coalesce(subtitle_url,'')='';" || true
    set -e
    echo "   OK 真音乐就位 ♪1 ${ndur}s ♪2 ${naltd:-0}s · 原词重合 ${same}% · 自己的字幕已挂 · 占位音留在版本行"
  else
    echo "   OK 真音乐就位 ♪1 ${ndur}s ♪2 ${naltd:-0}s · 原词重合 ${same}% · 占位音留在版本行"
    echo "      (等了 6 分钟没等到 subtitle_url —— 是【我没等到】不是【没生成】, 字幕流程仍在跑)"
  fi
  done_n=$((done_n+1))
done < <(cat "$MAN"; echo)

echo
echo "汇总: 清单 $plan · 做成 $done_n · 跳过 $skip_n · 失败 $fail_n$([ "$APPLY" = "0" ] && echo '  [干跑]')"
if [ $((done_n+skip_n+fail_n)) -ne "$plan" ]; then
  echo "FAIL: 三类加起来 $((done_n+skip_n+fail_n)) ≠ 清单 $plan —— 自己的账对不上, 上面的数不要信"; exit 1
fi
[ "$fail_n" = "0" ] && [ "$skip_n" = "0" ] || { echo "没过的清单:"; cat "$FAILED"; }
exit 0
