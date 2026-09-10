#!/usr/bin/env bash
# CSSOS W2086 —— 媒体覆盖风险巡检
#
# 由来: 2026-08-24 一批重生成把 17 个作品的旧版音乐【原地覆盖】, 永久丢失,
#       两周多之后才被 Jing 一首一首人肉发现。没人在看, 就等于没有防线。
#
# 三项检查, 任一非零即【报警退出码 1】, 可挂 cron / systemd timer。
#   A. 两条轨共用同一个 audio_url —— 「旧版记录」和新版指向同一份字节, 记录留住了字节没留住
#   B. 作品级媒体用写死 key(<workId>/a1.mp3 之类)—— 下次重生成就会覆盖
#   C. audio_url 指向的文件在 R2 上不存在 —— 已经断链
#
# 安全命名 = 内容哈希(aud-<sha>.mp3);危险命名 = 写死的 <workId>/固定名。
set -uo pipefail
PSQL=(env PGPASSWORD="${CSSOS_DB_PASS:-Au#20016}" psql -h 127.0.0.1 -U cssstudio -d cssstudio -tAF'|')
BUCKET="${CSSOS_R2_BUCKET:-r2:cssos-artifacts}"
alarm=0

echo "══ A. 多条轨共用同一个 audio_url(旧版没有自己的地址)══"
a=$("${PSQL[@]}" -c "
SELECT count(*) FROM (
  SELECT audio_url FROM work_language_tracks
   WHERE audio_url IS NOT NULL GROUP BY audio_url HAVING count(*) > 1) x" 2>/dev/null | tr -d ' ')
echo "   共用同一 URL 的地址数: ${a:-?}"
if [ "${a:-0}" -gt 0 ]; then
  "${PSQL[@]}" -c "
  SELECT left(w.title,44), count(*)||' 条轨共用'
    FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
   WHERE t.audio_url IN (SELECT audio_url FROM work_language_tracks
                          WHERE audio_url IS NOT NULL GROUP BY audio_url HAVING count(*)>1)
   GROUP BY w.title ORDER BY 1 LIMIT 30" 2>/dev/null | sed 's/^/   /'
  alarm=1
fi

echo
echo "══ B. 作品级音频用写死 key(重生成即覆盖)══"
b=$("${PSQL[@]}" -c "
SELECT count(*) FROM work_language_tracks
 WHERE audio_url IS NOT NULL AND audio_url NOT LIKE '%/artifacts/audio/aud-%'
   AND audio_url LIKE '%/artifacts/audio/%/a1.mp3'" 2>/dev/null | tr -d ' ')
echo "   写死 a1.mp3 的轨数: ${b:-?}   (安全写法应为内容哈希 aud-<sha>.mp3)"
[ "${b:-0}" -gt 0 ] && alarm=1

echo
echo "══ C. audio_url 已断链(R2 上没有该文件)══"
dead=0
while IFS='|' read -r url title; do
  [ -z "$url" ] && continue
  key="artifacts/${url#*/artifacts/}"
  rclone lsl "$BUCKET/$key" >/dev/null 2>&1 || { echo "   ❌ $title"; dead=$((dead+1)); }
done < <("${PSQL[@]}" -c "
SELECT DISTINCT t.audio_url, left(w.title,40) FROM work_language_tracks t
  JOIN user_works w ON w.id=t.work_id WHERE t.audio_url LIKE '%cdn.cssstudio.app/artifacts/%'" 2>/dev/null)
echo "   断链轨数: $dead"
[ "$dead" -gt 0 ] && alarm=1

echo
if [ "$alarm" -ne 0 ]; then
  echo "🔴 发现媒体覆盖风险 —— 见上。铁律: 凡写作品级媒体一律走 uploadR2NeverOverwrite。"
  exit 1
fi
echo "🟢 未发现覆盖风险。"
