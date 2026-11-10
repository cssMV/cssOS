#!/usr/bin/env bash
# W2292 —— 把「轨上时长是空/0、但那段音频其实量得到」的那些补上。
#
# Jing 2026-11-10 明确 yes:「一起补上吧」(63 个 take 槽, 60 条轨, 55 个作品)。
#
# ── 为什么这是个坑而不是小事 ────────────────────────────────────────────
# 时长为空会让 OVERRUN / 尾奏越界那类巡检【静默漏判】(曾漏过 54 处),
# 而且 2026-11-10 还因为「把 0 当成短」白扔过 8 首做好的歌(W2290)。
# 空值不报错, 只是让判据看不见 —— 所以它比一个错的数更难查。
#
# ── 判据: ffprobe 是尺子, 版本行只作交叉核对 ────────────────────────────
# 不照搬版本行的数。原因: 同一段音频在 work_media_versions 里常有多条
# (实测 41 组 2 条、3 组 3 条、1 组 4 条、1 组 5 条), 其中 26 组彼此的数还不一样
# —— 「版本行的数」本身就是歧义的(配版本行只能按 url 配, 这点照 W2145 的教训)。
# 本批这 63 个槽恰好版本行都唯一, 但判据不能靠「恰好」。
#
# 每个槽三种结局, 分开处理、分开计数:
#   ① ffprobe 量到, 且与版本行一致(±3s)        → 写 ffprobe 的数
#   ② ffprobe 量到, 但与版本行差 ≥3s           → 还是写 ffprobe 的数, 并【大声报】
#                                                 (版本行那个数可能本来就是错的)
#   ③ ffprobe 量不到                           → 【不写】, 单列报
#      不把没验过的数洗进这一列 —— 我们正是在让这一列变得可信。
#
# 只写「现在是空或 0」的槽, 非零值一个字不碰; 每写一个都回读核对。
# 不碰任何音频列、不碰字幕、不碰 user_works。串行, 不并发。
#
# 用法: DATABASE_URL=... bash w2292-fill-missing-take-durations.sh          # 干跑
#       DATABASE_URL=... bash w2292-fill-missing-take-durations.sh --apply
#       CALIBRATE=1 ...   # 校准: 改去挑【时长已经非零】的槽, 必须一个都不写。
#                         #       写了任何一个 = 「只补空值」那道闸是假的。
set -u
: "${DATABASE_URL:?没有 DATABASE_URL}"
APPLY=0; case " $* " in *" --apply "*) APPLY=1;; esac
CAL="${CALIBRATE:-0}"
TOL="${TOL:-3}"
q() { psql "$DATABASE_URL" -X -q -t -A -c "$1"; }
_ff() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | awk '{printf "%d", $1+0.5}'; }

# 有 12 条轨的 url 存的是【裸相对路径】(/personalization-templates/… , 欢迎/生日/首订阅那组模板),
# 没有主机。ffprobe 解析不了相对路径, curl 也连不上 —— 首版把它们全归进了「量不到」,
# 但它们并不是坏文件: 实测 https://cssstudio.app<path> 回 200(由 Node 端提供, CDN 上是 404)。
# 「取不到」与「没有」必须分开 —— 这里就是「我取的地址不对」, 不是「文件不存在」。
# 只对以 / 开头的路径做这个回退, 量到的仍然是 ffprobe 的数, 不是谁的猜测。
# (url 本身该不该补成绝对地址是另一件事, 本脚本一个字不动它。)
APPHOST="${APPHOST:-https://cssstudio.app}"
probe() {
  local u="$1" d
  d=$(_ff "$u"); if [ -n "${d:-}" ] && [ "${d:-0}" -gt 0 ]; then printf '%s' "$d"; return 0; fi
  case "$u" in /*) d=$(_ff "$APPHOST$u"); if [ -n "${d:-}" ] && [ "${d:-0}" -gt 0 ]; then printf '%s' "$d"; return 0; fi;; esac
  printf ''
}
LOG=/tmp/w2292-filled.tsv
UNP=/tmp/w2292-unmeasurable.tsv
DIS=/tmp/w2292-disagree.tsv
: > "$LOG"; : > "$UNP"; : > "$DIS"

# 选槽。CALIBRATE 时把「<=0」翻成「>0」—— 同一段代码, 只换选择条件,
# 这样校准真的在考那道写入闸, 而不是考一段另写的代码。
if [ "$CAL" = "1" ]; then COND=">"; echo "⚠ CALIBRATE=1 —— 改挑【时长已非零】的槽, 下面必须「已有非零值, 不碰」全中"
else COND="<="; fi

SEL="
WITH need AS (
  SELECT t.id AS tid, t.work_id, 1 AS tk, t.audio_url AS url, coalesce(t.duration_secs,0) AS cur
    FROM work_language_tracks t
   WHERE coalesce(t.audio_url,'') <> '' AND coalesce(t.duration_secs,0) $COND 0
  UNION ALL
  SELECT t.id, t.work_id, 2, t.alt_audio_url, coalesce(t.alt_duration_secs,0)
    FROM work_language_tracks t
   WHERE coalesce(t.alt_audio_url,'') <> '' AND coalesce(t.alt_duration_secs,0) $COND 0
)
SELECT n.tid||E'\t'||n.tk||E'\t'||n.cur||E'\t'
     ||coalesce((SELECT max(v.duration_secs) FROM work_media_versions v
                  WHERE v.work_id=n.work_id AND v.kind='audio' AND v.url=n.url
                    AND coalesce(v.duration_secs,0)>0),0)||E'\t'
     ||left(n.work_id::text,8)||E'\t'||left(coalesce(w.title,''),22)||E'\t'||n.url
  FROM need n JOIN user_works w ON w.id=n.work_id
 ORDER BY n.tid, n.tk"
[ "$CAL" = "1" ] && SEL="$SEL LIMIT 12"

rows=$(q "$SEL")
plan=$(printf '%s\n' "$rows" | grep -c . || true)
echo "清单 $plan 个 take 槽"
[ "$plan" -gt 0 ] || { echo "没有要补的"; exit 0; }

n=0; wrote=0; skip=0; unp=0; dis=0; err=0
while IFS=$'\t' read -r tid tk cur vdur w8 title url; do
  [ -n "${tid:-}" ] || continue
  n=$((n+1))
  printf '[%d/%d] tid=%s ♪%s  %s %s  库里=%s 版本行=%s\n' "$n" "$plan" "$tid" "$tk" "$w8" "$title" "$cur" "$vdur"
  if [ "${cur:-0}" -gt 0 ]; then
    echo "        已有非零值, 不碰"; skip=$((skip+1)); continue
  fi
  d=$(probe "$url")
  if [ -z "${d:-}" ] || [ "${d:-0}" -le 0 ]; then
    echo "        ⚠ ffprobe 量不到 —— 这是【判不了】, 不写任何数"
    printf '%s\t%s\t%s\t%s\t%s\n' "$tid" "$tk" "$w8" "$title" "$url" >>"$UNP"
    unp=$((unp+1)); continue
  fi
  if [ "${vdur:-0}" -gt 0 ]; then
    dd=$(( d - vdur )); [ "$dd" -lt 0 ] && dd=$(( -dd ))
    if [ "$dd" -ge "$TOL" ]; then
      echo "        ‼ 实测 ${d}s 与版本行 ${vdur}s 差 ${dd}s —— 写实测的, 版本行那个数要另查"
      printf '%s\t%s\t%s\t%s\t实测%s\t版本行%s\n' "$tid" "$tk" "$w8" "$title" "$d" "$vdur" >>"$DIS"
      dis=$((dis+1))
    fi
  else
    echo "        (版本行没给出正数 —— 无法交叉核对, 只有 ffprobe 一个来源)"
  fi
  if [ "$APPLY" = "0" ]; then echo "        [干跑] 会写 ${d}s"; wrote=$((wrote+1)); continue; fi
  if [ "$tk" = "1" ]; then
    q "UPDATE work_language_tracks SET duration_secs=$d
        WHERE id=$tid AND coalesce(duration_secs,0)<=0;" >/dev/null
    back=$(q "SELECT coalesce(duration_secs::text,'(空)') FROM work_language_tracks WHERE id=$tid;")
  else
    q "UPDATE work_language_tracks SET alt_duration_secs=$d
        WHERE id=$tid AND coalesce(alt_duration_secs,0)<=0;" >/dev/null
    back=$(q "SELECT coalesce(alt_duration_secs::text,'(空)') FROM work_language_tracks WHERE id=$tid;")
  fi
  if [ "$back" = "$d" ]; then
    echo "        ✅ 已写入并回读为 ${back}s"
    printf '%s\t%s\t%s\t%s\t%s\n' "$tid" "$tk" "$w8" "$title" "$d" >>"$LOG"
    wrote=$((wrote+1))
  else
    echo "        ⚠ 回读是 $back, 不是 $d —— 没写进去"; err=$((err+1))
  fi
done <<<"$rows"

echo
echo "汇总: 清单 $plan · 实际过了 $n · 写入 $wrote · 已有值不碰 $skip · 量不到 $unp · 回读不符 $err"
[ "$dis" -gt 0 ] && echo "      与版本行不一致 $dis 个 —— 见 $DIS(写的是实测值)"
[ "$unp" -gt 0 ] && echo "      量不到的 $unp 个 —— 见 $UNP(一个数都没写)"
[ "$APPLY" = "1" ] && [ "$wrote" -gt 0 ] && echo "      写入清单: $LOG"
if [ "$n" != "$plan" ]; then echo "FAIL 清单 $plan 但只过了 $n —— 有东西被吃掉了"; exit 2; fi
if [ "$CAL" = "1" ]; then
  [ "$wrote" = "0" ] && [ "$skip" = "$plan" ] && { echo "校准通过: 挑到已有值的槽, 一个都没写"; exit 0; }
  echo "FAIL 校准失败: 已有值的槽也被写了($wrote 个) —— 「只补空值」那道闸是假的"; exit 3
fi
[ "$err" = "0" ] || exit 1
