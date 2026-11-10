#!/usr/bin/env bash
# W2290 结账 —— 这一批(manifest-74)到底做成了几首, 每首六件事是否都齐。
#
# 不拿脚本日志当判据(日志说做成了不等于库里真做成了), 一律回读库 + 当场 ffprobe。
# 六个判据:
#   1 轨现在的音频在我们域名
#   2 不再是 /artifacts/mv-fallback/(占位音)
#   3 【实测】时长 ≥ MINDUR(默认 120s) —— 读库里的数当参考, 判据用 ffprobe
#      (这一批有 8 首因为轨的时长列是 0 被误判还原过, 见 W2290)
#   4 这条轨有【自己的】subtitle_url, 且键 = sha1(它自己的 audio_url)[:10]
#      —— 只看「非空」不够: 还原窗口里字幕可能按占位音的 URL 落了键
#   5 有 ♪2
#   6 旧占位音还在 work_media_versions 里(版本铁律: 只增不覆盖)
# 另外单独数: 库里的时长与实测不一致的(≥3s 差), 以及版本行里 ♪1 是否 is_current。
set -u
MAN="${1:-/tmp/w2285/manifest-74.tsv}"
MINDUR="${MINDUR:-120}"
: "${DATABASE_URL:?没有 DATABASE_URL}"
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }
probe() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | awk '{printf "%d", $1+0.5}'; }
[ -f "$MAN" ] || { echo "FAIL 没有清单 $MAN"; exit 2; }

plan=$(grep -c . "$MAN"); n=0; good=0
declare -a BAD=()
printf '%-24s %7s %7s  %s\n' 作品 库里 实测 "判据(1域名 2非占位 3实测时长 4自己的字幕+键对 5♪2 6占位音留着)"
while IFS=$'\t' read -r wid lang; do
  [ -n "${wid:-}" ] || continue
  n=$((n+1))
  row=$(q "SELECT left(coalesce(w.title,''),22)||E'\t'||coalesce(t.audio_url,'')||E'\t'
            ||coalesce(t.duration_secs,0)||E'\t'||coalesce(t.subtitle_url,'')||E'\t'
            ||coalesce(t.alt_audio_url,'')||E'\t'||coalesce(b.old_audio_url,'')
           FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
           LEFT JOIN (SELECT DISTINCT ON (track_id) * FROM w2285_placeholder_backup
                       ORDER BY track_id, backed_up_at DESC) b ON b.track_id=t.id
          WHERE t.work_id='$wid'::uuid AND t.lang='$lang' AND t.is_default LIMIT 1;")
  IFS=$'\t' read -r title au dbd sub alt oau <<<"$row"
  [ -n "${title:-}" ] || { printf '%-24s %7s %7s  ⚠ 库里查不到这条轨 —— 判不了\n' "${wid:0:8}" - -; BAD+=("$wid 查不到轨"); continue; }
  d=$(probe "$au")
  f=""
  case "$au" in https://cdn.cssstudio.app/*) ;; *) f="$f 1✗";; esac
  case "$au" in *mv-fallback*) f="$f 2✗(还是占位音)";; esac
  if [ -z "${d:-}" ] || [ "${d:-0}" -le 0 ]; then f="$f 3?(ffprobe 量不到 —— 判不了, 不是短)"
  elif [ "$d" -lt "$MINDUR" ]; then f="$f 3✗(${d}s)"; fi
  if [ -z "$sub" ]; then f="$f 4✗(字幕空)"
  else
    k=$(printf '%s' "$au" | sha1sum | cut -c1-10)
    case "$sub" in *"--a$k".json) ;; *) f="$f 4✗(字幕不是按自己的音频寻址)";; esac
  fi
  [ -n "$alt" ] || f="$f 5✗(无♪2)"
  if [ -n "$oau" ]; then
    hv=$(q "SELECT count(*) FROM work_media_versions WHERE work_id='$wid'::uuid AND kind='audio' AND url='$oau';")
    [ "${hv:-0}" -ge 1 ] || f="$f 6✗(占位音不在版本行)"
  fi
  dd=$(( ${d:-0} - dbd )); [ "$dd" -lt 0 ] && dd=$(( -dd ))
  mark=""; [ "$dd" -ge 3 ] && mark="(库里的数差 ${dd}s)"
  if [ -z "$f" ]; then printf '%-24s %6ss %6ss  ✅ 六项全过 %s\n' "$title" "$dbd" "${d:-?}" "$mark"; good=$((good+1))
  else printf '%-24s %6ss %6ss ' "$title" "$dbd" "${d:-?}"; echo "$f $mark"; BAD+=("$wid$f"); fi
done < "$MAN"
echo
echo "清单 $plan 首 · 实际核对 $n 首 · 六项全过 $good · 有问题 ${#BAD[@]}"
[ "$n" = "$plan" ] || { echo "FAIL 核对数 $n ≠ 清单 $plan —— 上面的数不要信"; exit 1; }
[ $((good+${#BAD[@]})) = "$n" ] || { echo "FAIL 两类加起来 $((good+${#BAD[@]})) ≠ $n —— 自己的账对不上"; exit 1; }
exit $([ "${#BAD[@]}" = 0 ] && echo 0 || echo 1)
