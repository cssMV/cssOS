#!/usr/bin/env bash
# W2291 —— 一首作品「做完了」到底指什么: 逐颗 ♪ 验, 不是逐首验。
#
# 为什么要有这份: W2290 那批的结账脚本(w2290-final-tally.sh)判的是【轨】那一层,
# 所以它看的是 ♪1 的字幕和时长。这两首跑完时, 莫扎特的 ♪2 时长在轨上是空的、
# 米开朗基罗的 ♪2 字幕当时还没落盘 —— 结账照样打 ✅。
# 「一首做完」= 它的【每一颗 ♪】都各自齐全, 这份就按这个判。
#
# 每颗 ♪ 五项:
#   a 字幕键 = sha1(它自己那段音频)[:10] —— 非空不够, 必须指向自己
#     (还原窗口里字幕可能按占位音的 URL 落了键, 见 W2290)
#   b 字幕真能取到(HTTP 200)且是合法 JSON
#   c 字幕最后一个字的结束 ≤ 实测时长 + 3s —— 越界就是对到别的音频上去了
#   d ♪1 与 ♪2 必须是两份不同的字幕文件 —— 同一份 = 又回到共用(W2289)
#   e 实测时长与库里的数一致(±3s), 且库里的数不能是空的
#     (时长为空会让 OVERRUN / OUTRO_OVER 巡检静默漏判, 见 take-duration-must-be-measured)
# 外加: 旧占位音的字节必须还能取到 —— 版本铁律是「旧字节要有自己的地址」,
#       库里留一条记录不算数(W2061 那 17 首正是记录在、字节没了)。
#
# 判据一律当场实测(ffprobe / curl), 不信库里的数、不看生成日志。
# 「取不到 / 判不了」单列报, 绝不混成「没有」—— 这正是 W2290 误杀 8 首的那个错。
#
# 用法: DATABASE_URL=... bash w2291-verify-takes-complete.sh <work-id 前缀> [更多前缀...]
#       CALIBRATE=1 bash ...   # 校准: 故意把期望的键改错, 五项里的 a 必须全部报错。
#                              #       校准跑不出错 = 判据是假的, 别信它的 ✅。
set -u
: "${DATABASE_URL:?没有 DATABASE_URL}"
CAL="${CALIBRATE:-0}"
[ "$#" -ge 1 ] || { echo "用法: $0 <work-id 前缀> [...]"; exit 2; }
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }
probe() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | awk '{printf "%d", $1+0.5}'; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
bad=0; checked=0
[ "$CAL" = "1" ] && echo "⚠ CALIBRATE=1 —— 期望的字幕键被故意改错, 下面 a✗ 必须全中"

subend() {
  python3 -I -c '
import json,sys
def walk(o,out):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in ("t_end","end_ms") and isinstance(v,(int,float)): out.append(float(v))
            else: walk(v,out)
    elif isinstance(o,list):
        for v in o: walk(v,out)
try: d=json.load(open(sys.argv[1],encoding="utf-8"))
except Exception: print("?"); sys.exit(0)
e=[]; walk(d,e)
print(f"{max(e)/1000:.0f}" if e else "?")' "$1"
}

for pre in "$@"; do
  wid=$(q "SELECT id::text FROM user_works WHERE id::text LIKE '$pre%';")
  n=$(printf '%s' "$wid" | grep -c . || true)   # 别用 wc -l: 无尾换行时数成 0(W2289 栽过)
  [ "$n" = "1" ] || { echo "$pre ⚠ 匹配到 $n 个作品 —— 不猜"; bad=$((bad+1)); continue; }
  title=$(q "SELECT left(coalesce(title,''),24) FROM user_works WHERE id='$wid'::uuid;")
  lang=$(q "SELECT coalesce(lang,'') FROM work_language_tracks
             WHERE work_id='$wid'::uuid AND is_default LIMIT 1;")
  echo "=== ${wid:0:8}  $title  (默认轨 lang=${lang:-(空)})"
  subs=""
  for tk in 1 2; do
    if [ "$tk" = 1 ]; then col=audio_url; dcol=duration_secs; else col=alt_audio_url; dcol=alt_duration_secs; fi
    row=$(q "SELECT coalesce($col,'')||'|'||coalesce($dcol::text,'')
               FROM work_language_tracks WHERE work_id='$wid'::uuid AND is_default LIMIT 1;")
    au=${row%%|*}; dbd=${row#*|}
    [ -n "$au" ] || { echo "   ♪$tk 不存在"; continue; }
    vs=$(q "SELECT coalesce(subtitle_url,'') FROM work_media_versions
             WHERE work_id='$wid'::uuid AND kind='audio' AND url='$au' LIMIT 1;")
    checked=$((checked+1)); f=""; se="?"
    d=$(probe "$au"); [ -n "${d:-}" ] && [ "${d:-0}" -gt 0 ] || { d="?"; f="$f 实测?(量不到 —— 判不了, 不是短)"; }
    k=$(printf '%s' "$au" | sha1sum | cut -c1-10); [ "$CAL" = "1" ] && k="${k}x"
    if [ -z "$vs" ]; then f="$f a✗(版本行上没有自己的字幕)"
    else case "$vs" in *"--a$k".json) ;; *) f="$f a✗(字幕不是按它自己的音频寻址)";; esac; fi
    if [ -n "$vs" ]; then
      code=$(curl -s -o "$T/$tk.json" -w '%{http_code}' -m 40 "$vs" || echo 000)
      if [ "$code" != "200" ]; then f="$f b✗(字幕 HTTP $code)"
      else
        python3 -I -c 'import json,sys; json.load(open(sys.argv[1],encoding="utf-8"))' "$T/$tk.json" \
          2>/dev/null || f="$f b✗(不是合法 JSON)"
        se=$(subend "$T/$tk.json")
        if [ "$se" = "?" ]; then f="$f c?(字幕里一个时间戳都没有 —— 判不了)"
        elif [ "$d" != "?" ] && [ "$se" -gt $(( d + 3 )) ]; then f="$f c✗(字幕末 ${se}s > 音频 ${d}s)"; fi
      fi
      subs="$subs $(basename "$vs")"
    fi
    if [ -z "$dbd" ] || [ "$dbd" = "0" ]; then f="$f e✗(库里的时长是空/0 —— 巡检会静默漏判)"
    elif [ "$d" != "?" ]; then
      dd=$(( d - dbd )); [ "$dd" -lt 0 ] && dd=$(( -dd ))
      [ "$dd" -ge 3 ] && f="$f e✗(库里 ${dbd}s vs 实测 ${d}s)"
    fi
    if [ -z "$f" ]; then printf '   ♪%s  音频 %ss(库里 %ss) · 字幕末 %ss · 键对 ✅\n' "$tk" "$d" "$dbd" "$se"
    else printf '   ♪%s  音频 %ss(库里 %ss) · 字幕末 %ss ' "$tk" "$d" "$dbd" "$se"; echo "⚠$f"; bad=$((bad+1)); fi
  done
  u=$(printf '%s\n' $subs | sort -u | grep -c . || true); t=$(printf '%s\n' $subs | grep -c . || true)
  if [ "$t" -ge 2 ] && [ "$u" -lt "$t" ]; then echo "   ⚠ d✗ 两颗 ♪ 共用同一份字幕"; bad=$((bad+1))
  elif [ "$t" -ge 2 ]; then echo "   d✅ 两颗 ♪ 各一份字幕"; fi
  oau=$(q "SELECT url FROM work_media_versions
            WHERE work_id='$wid'::uuid AND kind='audio' AND url LIKE '%mv-fallback%' LIMIT 1;")
  if [ -z "$oau" ]; then echo "   (这首没有占位音版本行 —— 本来就不是替换来的, 不算问题)"
  else
    c=$(curl -s -o /dev/null -w '%{http_code}' -m 25 "$oau" || echo 000)
    case "$c" in 200) echo "   旧占位音字节仍可取 ✅(HTTP 200)";;
                 *) echo "   ⚠ 旧占位音 HTTP $c —— 取不到/判不了(版本铁律要旧字节有自己的地址)";; esac
  fi
done
echo
echo "核对 $checked 颗 ♪ · 有问题 $bad"
if [ "$CAL" = "1" ]; then
  [ "$bad" -ge "$checked" ] && { echo "校准通过: 键改错后每颗 ♪ 都被判出问题"; exit 0; }
  echo "校准失败: 键改错了却还有 ♪ 判成合格 —— 这份判据是假的"; exit 3
fi
[ "$bad" = 0 ] || exit 1
