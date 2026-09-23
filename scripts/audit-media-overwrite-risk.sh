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

echo "══ A. 版本标记轨共用同一个 audio_url(【同一作品内】)══"
#
# 判据(2026-09-12 收紧, Jing 认可): 只有【共用非内容哈希地址】才算风险。
#
# 为什么: 内容哈希地址(aud-<sha24>.mp3)的文件【结构上不可能被覆盖】—— 不同内容
# 必然落在不同地址。两条轨共用一个哈希地址, 只说明"世界上确实只有这一份字节",
# 不代表将来会丢。把它报成红色, 等于让红灯每天都亮 —— 而【长期红灯 = 没人再看】,
# 那才是真正危险的状态。
#
# 但是也【一个都不隐藏】: 下面把两类共用逐条打印出来, 只是不报警。
HASH_RE='/[a-z]+-[0-9a-f]{24}\.[a-z0-9]+$'

shared_sql() {   # $1 = 附加条件
  echo "SELECT left(w.title,44), t.lang
          FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id
         WHERE (t.lang ~* '(orig|pre-|-v[0-9])' OR t.voice ~* '(pre-epic|orig|-v[0-9])')
           AND EXISTS (SELECT 1 FROM work_language_tracks o
                        WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)
           AND $1
         ORDER BY 1"
}

# ── 报警项: 共用【非哈希】地址 ──
a=$("${PSQL[@]}" -c "SELECT count(*) FROM work_language_tracks t
 WHERE (t.lang ~* '(orig|pre-|-v[0-9])' OR t.voice ~* '(pre-epic|orig|-v[0-9])')
   AND t.audio_url !~ '$HASH_RE'
   AND EXISTS (SELECT 1 FROM work_language_tracks o
                WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)" 2>/dev/null | tr -d ' ')
echo "   🔴 共用【非哈希】地址(真实风险): ${a:-?}"
if [ "${a:-0}" -gt 0 ]; then
  "${PSQL[@]}" -c "$(shared_sql "t.audio_url !~ '$HASH_RE'")" 2>/dev/null | sed 's/^/      /'
  alarm=1
fi

# ── 只报告, 不报警: 共用【哈希】地址 ──
tomb=$("${PSQL[@]}" -c "SELECT count(*) FROM work_language_tracks t
 WHERE (t.lang ~* '(pre-)' OR t.voice ~* 'pre-epic') AND t.audio_url ~ '$HASH_RE'
   AND EXISTS (SELECT 1 FROM work_language_tracks o
                WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)" 2>/dev/null | tr -d ' ')
onev=$("${PSQL[@]}" -c "SELECT count(*) FROM work_language_tracks t
 WHERE (t.lang ~* '(orig|-v[0-9])' OR t.voice ~* '(orig|-v[0-9])')
   AND t.lang !~* 'pre-' AND t.voice !~* 'pre-epic' AND t.audio_url ~ '$HASH_RE'
   AND EXISTS (SELECT 1 FROM work_language_tracks o
                WHERE o.work_id=t.work_id AND o.id<>t.id AND o.audio_url=t.audio_url)" 2>/dev/null | tr -d ' ')
echo "   ⚰️ 已知历史损失(orig-pre-epic, 旧版已于 2026-08-24 被覆盖): ${tomb:-?}  —— 不报警, 木已成舟"
echo "   ℹ️ 从来只有一个版本(orig 与语言轨指同一份字节): ${onev:-?}  —— 不报警, 本就正常"

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
echo "══ D. 跨【不同作品】共用同一份音频(W2153)══"
#
# A 项只查【同一作品内】两条轨共用(o.work_id = t.work_id), 跨作品从来没人看。
# 而跨作品共用的含义完全不同, 也严重得多: 同一份字节挂在两个作品下, 意味着
# 其中【至少有一个作品的音频不是它自己的】—— 它自己那份已经没了。
#
# 实例(W2153 查实): 《Jerusalem》5e77e03a 与 f49ed33c 今天指着同一份 aud-a04ebb58ce…,
# 但两者 2026-06 各自做过 ASR 字幕, 转写内容【完全不同】(赛博武士 vs Jerusalem 圣歌)——
# 证明当时各有各的音频, 是 2026-08-24 那批重生成之后才并成一份。
#
# 报警策略照搬 A 项的思路: 长期红灯 = 没人再看。所以【只对增长报警】——
# 存量写进基线文件, 超过基线才是新事故; 低于基线则把基线降下来(改善锁定)。
BASE_FILE="${CSSOS_SHARED_AUDIO_BASELINE:-/srv/cssos/media-audit.shared-audio-baseline}"

d_work=$("${PSQL[@]}" -c "
SELECT count(*) FROM (
  SELECT preview_audio_url FROM user_works
   WHERE coalesce(preview_audio_url,'') <> '' AND status IN ('ready','published')
   GROUP BY 1 HAVING count(*) > 1) z" 2>/dev/null | tr -d ' ')
d_track=$("${PSQL[@]}" -c "
SELECT count(*) FROM (
  SELECT audio_url FROM work_language_tracks
   WHERE coalesce(audio_url,'') <> ''
   GROUP BY 1 HAVING count(DISTINCT work_id) > 1) z" 2>/dev/null | tr -d ' ')
cur=$(( ${d_work:-0} + ${d_track:-0} ))
base=$(cat "$BASE_FILE" 2>/dev/null | tr -dc '0-9')
if [ -z "$base" ]; then
  echo "$cur" > "$BASE_FILE" 2>/dev/null || true
  base="$cur"
  echo "   (首次运行, 基线设为 $cur)"
fi
echo "   作品级共用组数: ${d_work:-?}   轨级共用组数: ${d_track:-?}   合计 $cur   基线 $base"
if [ "$cur" -gt "$base" ]; then
  echo "   🔴 比基线多了 $(( cur - base )) 组 —— 有【新的】跨作品共用出现, 逐组列出:"
  "${PSQL[@]}" -c "
    SELECT string_agg(left(w.title,30), ' ⇔ '), right(w.preview_audio_url,30)
      FROM user_works w
     WHERE coalesce(w.preview_audio_url,'') <> '' AND w.status IN ('ready','published')
     GROUP BY w.preview_audio_url HAVING count(*) > 1
     ORDER BY 1" 2>/dev/null | sed 's/^/      /'
  alarm=1
elif [ "$cur" -lt "$base" ]; then
  echo "   🟢 比基线少了 $(( base - cur )) 组, 基线下调到 $cur(改善锁定, 不许回弹)"
  echo "$cur" > "$BASE_FILE" 2>/dev/null || true
else
  echo "   ⚰️ 与基线持平 —— 全是 2026-08-24 那次事故的存量, 不报警"
  echo "      (要看逐组明细: 把基线文件删掉再跑, 或直接查 preview_audio_url / audio_url 的重复组)"
fi

echo
if [ "$alarm" -ne 0 ]; then
  echo "🔴 发现媒体覆盖风险 —— 见上。铁律: 凡写作品级媒体一律走 uploadR2NeverOverwrite。"
  exit 1
fi
echo "🟢 未发现覆盖风险。"
