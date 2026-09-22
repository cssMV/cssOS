#!/usr/bin/env bash
# W2131 落地: 按 w2131-plan.tsv 把占位符语言标签校正成真实语言。
# 用法: w2131-apply.sh <plan文件> [条数上限]
#
# 两半一起改(缺一不可, 理由见 w2131-fix-placeholder-langs.sh 抬头):
#   ① work_language_tracks.lang: 'orig'/'auto'/'' → 真实语言(保留各自的 voice)
#   ② 字幕 JSON 里 languages[].lang 的占位符条目 → 同一个真实语言
#
# 安全闸(每一条都会在汇总里自曝):
#   · 目标 (work_id, lang, voice) 已存在 → 这条轨跳过, 不制造唯一键冲突
#   · 字幕文件里已经有同名真实条目 → 不retag, 免得一个文件里两条同语言
#   · 'orig-pre-epic' 不在选取范围内(它是版本标记, 旗舰墙按它查)
#   · 字幕旧字节先另存 -pre-w2131.json, 再写回
set -u
export PGPASSWORD="${PGPASSWORD:-Au#20016}"
PLAN="${1:?用法: $0 <plan> [上限]}"
LIMIT="${2:-0}"
BUCKET="r2:cssos-artifacts"

psql -h 127.0.0.1 -U cssstudio -d cssstudio -q -c "
CREATE TABLE IF NOT EXISTS w2130_track_lang_backup (
  track_id bigint PRIMARY KEY, work_id uuid NOT NULL,
  old_lang text NOT NULL, new_lang text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());"

cat > /tmp/w2131_retag.py <<'PY'
import sys, json
newlang = sys.argv[1]
PLACE = {"", "orig", "auto", "und"}
d = json.load(sys.stdin)
langs = d.get("languages") or []
have_real = {str(L.get("lang") or "").lower() for L in langs if str(L.get("lang") or "").lower() not in PLACE}
if newlang.lower() in have_real:
    sys.stderr.write("SKIP 文件里已有 %s 条目\n" % newlang); sys.exit(4)
hit = 0
for L in langs:
    if str(L.get("lang") or "").lower() in PLACE:
        L["lang"] = newlang; hit += 1
if not hit:
    sys.stderr.write("NOOP 文件里没有占位符条目\n"); sys.exit(5)
sys.stderr.write("RETAG %d 条 → %s\n" % (hit, newlang))
json.dump(d, sys.stdout, ensure_ascii=False)
PY

n=0; trk=0; trkskip=0; sub=0; subskip=0; err=0
while IFS=$'\x1f' read -r id newlang why tags title <&3; do
  [ -z "${id:-}" ] && continue
  n=$((n+1))
  [ "$LIMIT" -gt 0 ] && [ "$n" -gt "$LIMIT" ] && { n=$((n-1)); break; }

  # ① 轨标签
  got=$(psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -c "
    WITH cand AS (
      SELECT t.id, t.voice FROM work_language_tracks t
       WHERE t.work_id='$id'::uuid AND t.lang IN ('orig','auto','')
         AND NOT EXISTS (SELECT 1 FROM work_language_tracks x
                          WHERE x.work_id=t.work_id AND x.lang='$newlang' AND x.voice=t.voice)
    ), bak AS (
      INSERT INTO w2130_track_lang_backup (track_id, work_id, old_lang, new_lang)
      SELECT t.id, t.work_id, t.lang, '$newlang' FROM work_language_tracks t JOIN cand c ON c.id=t.id
      ON CONFLICT (track_id) DO NOTHING RETURNING 1
    ), upd AS (
      UPDATE work_language_tracks t SET lang='$newlang', updated_at=now()
        FROM cand c WHERE t.id=c.id RETURNING 1
    )
    SELECT (SELECT count(*) FROM upd);" 2>/dev/null)
  trk=$((trk + ${got:-0}))
  [ "${got:-0}" = "0" ] && trkskip=$((trkskip+1))

  # ② 字幕文件里的占位符条目
  main="works/$id/subtitle-take1.json"
  tmp="/tmp/w2131_$$.json"
  msg=$(rclone cat "$BUCKET/$main" 2>/dev/null | python3 /tmp/w2131_retag.py "$newlang" 2>&1 >"$tmp")
  rc=$?
  case "$rc" in
    0) rclone rcat "$BUCKET/$main.tmp-pre" < /dev/null 2>/dev/null || true
       rclone copyto "$BUCKET/$main" "$BUCKET/works/$id/subtitle-take1-pre-w2131.json" 2>/dev/null
       rclone rcat "$BUCKET/$main" < "$tmp" 2>/dev/null
       for snap in $(rclone lsf "$BUCKET/works/$id/" 2>/dev/null | grep -E '^subtitle-take1--a[0-9a-f]+\.json$'); do
         rclone rcat "$BUCKET/works/$id/$snap" < "$tmp" 2>/dev/null
       done
       sub=$((sub+1));;
    4|5) subskip=$((subskip+1));;
    *)   err=$((err+1)); printf '❌ [%d] %s %s\n' "$n" "${id:0:8}" "$msg";;
  esac
  rm -f "$tmp"
  [ $((n % 50)) -eq 0 ] && echo "  …已处理 $n" >&2
done 3< "$PLAN"

echo
echo "=== W2131 落地: 清单 $(wc -l < "$PLAN") 首, 本轮处理 $n 首 ==="
echo "  轨标签改了 $trk 条 · 整首无可改的轨 $trkskip 首"
echo "  字幕文件retag $sub 首 · 无需retag $subskip 首 · 出错 $err 首"
