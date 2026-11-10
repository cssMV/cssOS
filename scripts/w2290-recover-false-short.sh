#!/usr/bin/env bash
# W2290 —— 把【被误判为「成品太短」而还原掉的】作品免费救回来。
#
# 为什么会有这种作品: w2285 第 7 步按轨的 duration_secs 判时长, 而 Suno 有时不回 ♪1
# 的时长, 那一列就是 0。0 < 120 → 判「歌词短了」→ restore() 还原成 60s 占位音。
# 实测鲁米(2207fb38, 2026-11-10): 轨读 0s, 同一刻版本行里 W2272 的 ffprobe 已量到
# ♪1=234s / ♪2=290s —— 一首真做好的歌被扔掉, 12 credit 白花。
# 判据的毛病是把【量不到】当成【没有】。脚本侧已修(见 w2285 第 7 步 W2290 注释),
# 这个脚本负责把已经被扔掉的那些捡回来。
#
# 为什么是【免费】: restore() 只改库里的指针, 一个字节都没删 —— 新音频是内容哈希命名,
# 还躺在 R2 原地, 版本行也还指着它。所以救回来 = 把指针指回去, 不用重新生成。
#
# 不猜、不越界:
#   · 时长【当场 ffprobe 实测】, 不信任何一边记的数(take-duration-must-be-measured)。
#   · 域名 / 不是 mv-fallback / ≥MINDUR / 原词重合 ≥80% 四项照 w2285 的原判据再过一遍。
#   · 占位音那条版本行一个字不动(版本铁律: 旧版必须留着自己的地址)。
#   · 任何一项拿不准就跳过并打印原因, 绝不半途改一半。
# 默认干跑; --apply 才真写。用法: bash w2290-recover-false-short.sh [--apply] <work_id> ...
set -u
APPLY=0
args=()
for a in "$@"; do [ "$a" = "--apply" ] && APPLY=1 || args+=("$a"); done
: "${DATABASE_URL:?没有 DATABASE_URL}"
MINDUR="${MINDUR:-120}"
q()  { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }
qx() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "$1" >/dev/null; }
probe() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | awk '{printf "%d", $1+0.5}'; }

[ "${#args[@]}" -gt 0 ] || { echo "用法: bash $0 [--apply] <work_id> ..."; exit 2; }
ok_n=0; skip_n=0
for wid in "${args[@]}"; do
  title=$(q "SELECT left(coalesce(title,''),26) FROM user_works WHERE id='$wid'::uuid;")
  echo "=== $wid  $title"
  [ -n "$title" ] || { echo "   SKIP 库里没有这个作品 —— 不猜"; skip_n=$((skip_n+1)); continue; }
  row=$(q "SELECT id||'|'||lang||'|'||coalesce(audio_url,'')||'|'||coalesce(duration_secs,0)
             FROM work_language_tracks WHERE work_id='$wid'::uuid AND is_default;")
  [ "$(printf '%s' "$row" | grep -c .)" = "1" ] || { echo "   SKIP 默认轨不是 1 条 —— 不猜"; skip_n=$((skip_n+1)); continue; }
  tid=${row%%|*}; r=${row#*|}; lang=${r%%|*}; r=${r#*|}; cau=${r%%|*}; cdur=${r#*|}
  echo "   轨 id=$tid $lang  现在挂着 ${cdur}s …${cau: -30}"
  case "$cau" in *mv-fallback*) ;; *)
    echo "   SKIP 这条轨现在【不是】占位音 —— 它没被还原, 没什么要救的"; skip_n=$((skip_n+1)); continue;; esac

  # 这一轮生成出来的 ♪1 / ♪2 —— 从版本行里认(还原不会动版本行)
  v1=$(q "SELECT coalesce(url,'')||'|'||coalesce(subtitle_url,'') FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND label LIKE '%♪1'
             AND url NOT LIKE '%mv-fallback%' ORDER BY id DESC LIMIT 1;")
  v2=$(q "SELECT coalesce(url,'')||'|'||coalesce(subtitle_url,'') FROM work_media_versions
           WHERE work_id='$wid'::uuid AND kind='audio' AND label LIKE '%♪2'
             AND url NOT LIKE '%mv-fallback%' ORDER BY id DESC LIMIT 1;")
  nau=${v1%%|*}; nsub=${v1#*|}; nalt=${v2%%|*}
  [ -n "$nau" ] || { echo "   SKIP 版本行里找不到这一轮的 ♪1 —— 没有可救的字节"; skip_n=$((skip_n+1)); continue; }

  d1=$(probe "$nau"); d2=""; [ -n "$nalt" ] && d2=$(probe "$nalt")
  echo "   实测 ♪1 ${d1:-判不了}s  ♪2 ${d2:-无}s   ♪1 …${nau: -30}"
  bad=""
  case "$nau" in https://cdn.cssstudio.app/*) ;; *) bad="$bad ♪1 不在我们域名";; esac
  case "$nau" in *mv-fallback*) bad="$bad ♪1 还是占位物";; esac
  if [ -z "${d1:-}" ] || [ "${d1:-0}" -le 0 ]; then bad="$bad ♪1 的时长【ffprobe 量不到】—— 判不了, 不是短"
  elif [ "$d1" -lt "$MINDUR" ]; then bad="$bad ♪1 实测 ${d1}s < ${MINDUR}s(这是真短)"; fi
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
            if x.strip() and not x.strip().startswith(("[", "【"))]
b, a = body(tl), set(body(wl))
print(0 if not b else round(100 * sum(1 for x in b if x in a) / len(b)))
PYSAME
)
  [ "${same:-0}" -ge 80 ] || bad="$bad 唱的词与原词只重合 ${same:-0}%"
  if [ -n "$bad" ]; then echo "   SKIP 不救:$bad"; skip_n=$((skip_n+1)); continue; fi
  echo "   四项都过(域名 ✅ 非占位 ✅ 实测 ${d1}s ✅ 原词重合 ${same}% ✅)"
  [ "$APPLY" = 1 ] || { echo "   [干跑] 会把轨指回 ♪1/♪2 + 自己的字幕, 作品 preview 指向 ♪1, ♪1 设 current"; ok_n=$((ok_n+1)); continue; }

  qx "UPDATE work_language_tracks SET audio_url='$nau', duration_secs=$d1,
        alt_audio_url=$([ -n "$nalt" ] && echo "'$nalt'" || echo NULL),
        alt_duration_secs=$([ -n "${d2:-}" ] && [ "${d2:-0}" -gt 0 ] && echo "$d2" || echo NULL),
        subtitle_url=$([ -n "$nsub" ] && echo "'$nsub'" || echo NULL),
        status='ready', updated_at=now()
      WHERE id=$tid;"
  qx "UPDATE work_media_versions SET duration_secs=$d1
       WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';"
  [ -n "${d2:-}" ] && [ "${d2:-0}" -gt 0 ] && [ -n "$nalt" ] && qx "UPDATE work_media_versions SET duration_secs=$d2
       WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nalt';"
  qx "UPDATE work_media_versions SET is_current=false
       WHERE work_id='$wid'::uuid AND kind='audio' AND is_current AND url<>'$nau';"
  qx "UPDATE work_media_versions SET is_current=true
       WHERE work_id='$wid'::uuid AND kind='audio' AND url='$nau';"
  qx "UPDATE user_works SET preview_audio_url='$nau', duration_secs=$d1, updated_at=now()
       WHERE id='$wid'::uuid;"

  # 回读 —— 判据是库里真躺着什么, 不是上面几条 SQL 有没有报错
  ba=$(q "SELECT coalesce(audio_url,'')||'|'||coalesce(duration_secs,0)||'|'||coalesce(subtitle_url,'')
            FROM work_language_tracks WHERE id=$tid;")
  pv=$(q "SELECT coalesce(preview_audio_url,'')||'|'||coalesce(duration_secs,0) FROM user_works WHERE id='$wid'::uuid;")
  cn=$(q "SELECT count(*) FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND is_current AND url='$nau';")
  ph=$(q "SELECT count(*) FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url LIKE '%mv-fallback%';")
  if [ "${ba%%|*}" = "$nau" ] && [ "${pv%%|*}" = "$nau" ] && [ "$cn" = "1" ] && [ "${ph:-0}" -ge 1 ]; then
    echo "   OK 救回: 轨 ${d1}s 自己的字幕$([ -n "$nsub" ] && echo '已挂' || echo '(版本行里还没有)') · preview 已指向 ♪1 · ♪1 是 current · 占位音仍在版本行"
    ok_n=$((ok_n+1))
  else
    echo "   FAIL 回读对不上: 轨=${ba: -40} preview=${pv: -40} current=$cn 占位版本行=$ph"; skip_n=$((skip_n+1))
  fi
done
echo
echo "清单 ${#args[@]} 首 · 救回 $ok_n · 跳过 $skip_n$([ "$APPLY" = 0 ] && echo '  [干跑]')"
[ $((ok_n+skip_n)) -eq "${#args[@]}" ] || { echo "FAIL 两类加起来 $((ok_n+skip_n)) ≠ 清单 ${#args[@]} —— 上面的数不要信"; exit 1; }
