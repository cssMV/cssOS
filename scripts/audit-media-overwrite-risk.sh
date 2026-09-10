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

echo "══ A. 版本标记轨与他轨共用同一个 audio_url(旧版没有自己的地址)══"
# 只看【版本标记轨】(lang 含 orig / pre / -v 等), 不把「多语言共用同一条伴奏」误报成风险 ——
# 一首曲子配 15 种语言字幕、共用同一条音频, 那是正常的, 不是覆盖风险。
a=$("${PSQL[@]}" -c "
SELECT count(DISTINCT t.work_id)
  FROM work_language_tracks t
 WHERE t.lang ~* '(orig|pre-|-v[0-9])'
   AND EXISTS (SELECT 1 FROM work_language_tracks o
                WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)" 2>/dev/null | tr -d ' ')
echo "   版本标记轨与他轨共用地址的作品数: ${a:-?}"
if [ "${a:-0}" -gt 0 ]; then
  "${PSQL[@]}" -c "
  SELECT left(w.title,44), t.lang
    FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
   WHERE t.lang ~* '(orig|pre-|-v[0-9])'
     AND EXISTS (SELECT 1 FROM work_language_tracks o
                  WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)
   ORDER BY 1 LIMIT 40" 2>/dev/null | sed 's/^/   /'
  alarm=1
fi

# 参考项(不报警): 多语言共用同一条音频, 属正常
ml=$("${PSQL[@]}" -c "
SELECT count(*) FROM (SELECT audio_url FROM work_language_tracks
  WHERE audio_url IS NOT NULL GROUP BY audio_url HAVING count(*)>1) x" 2>/dev/null | tr -d ' ')
echo "   (参考·不报警) 多条轨共用同一地址的地址数: ${ml:-?} —— 多语言共用伴奏属正常"

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
# 一次性把 artifacts/audio/ 整个前缀列出来做成集合, 再本地比对 ——
# 原来「每条轨调一次 rclone」在几百条轨上要十几分钟, 那样的脚本挂不了 cron。
LIST=$(mktemp); TRK=$(mktemp)
rclone lsf -R --files-only "$BUCKET/artifacts/audio/" 2>/dev/null | sed 's|^|artifacts/audio/|' | sort > "$LIST"
"${PSQL[@]}" -c "
SELECT DISTINCT t.audio_url, left(w.title,40) FROM work_language_tracks t
  JOIN user_works w ON w.id=t.work_id
 WHERE t.audio_url LIKE '%cdn.cssstudio.app/artifacts/audio/%'" 2>/dev/null > "$TRK"
dead=0
while IFS='|' read -r url title; do
  [ -z "$url" ] && continue
  key="artifacts/audio/${url##*/artifacts/audio/}"
  grep -qxF "$key" "$LIST" || { echo "   ❌ $title"; dead=$((dead+1)); }
done < "$TRK"
echo "   R2 上音频对象数: $(wc -l < "$LIST")   库中引用: $(wc -l < "$TRK")   断链: $dead"
rm -f "$LIST" "$TRK"
[ "$dead" -gt 0 ] && alarm=1

echo
if [ "$alarm" -ne 0 ]; then
  echo "🔴 发现媒体覆盖风险 —— 见上。铁律: 凡写作品级媒体一律走 uploadR2NeverOverwrite。"
  exit 1
fi
echo "🟢 未发现覆盖风险。"
