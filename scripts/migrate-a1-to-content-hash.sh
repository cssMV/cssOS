#!/usr/bin/env bash
# CSSOS W2086 —— 把写死的 <workId>/a1.mp3 迁到内容哈希命名 aud-<sha24>.mp3
#
# Jing 2026-09-11:「以后都必须哈希命名, 避免重名被覆盖掉。」
#
# 为什么必须迁: 写死的名字 = 同一作品重新生成必然落回同一地址 = 原地覆盖。
# 2026-08-24 那批 17 首旧版音乐就是这样没的。内容哈希则是【不同内容必然不同地址】。
#
# 安全原则(不可违背):
#   · 只【复制】到新地址, **绝不删除旧的 a1.mp3** —— 删字节正是我们要避免的事
#   · 先校验新对象存在且大小一致, 再改库
#   · 默认干跑; 真正执行要显式加 --apply
set -uo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
PSQL=(env PGPASSWORD="${CSSOS_DB_PASS:-Au#20016}" psql -h 127.0.0.1 -U cssstudio -d cssstudio)
Q=("${PSQL[@]}" -tAF'|')
BUCKET="${CSSOS_R2_BUCKET:-r2:cssos-artifacts}"
CDN="https://cdn.cssstudio.app"
[ "$APPLY" = 1 ] && echo "=== 真正执行 ===" || echo "=== 干跑(不改任何东西), 加 --apply 才真做 ==="

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
declare -i ok=0 skip=0 fail=0

"${Q[@]}" -c "
SELECT DISTINCT u FROM (
  SELECT audio_url u FROM work_language_tracks WHERE audio_url LIKE '%/artifacts/audio/%/a1.mp3'
  UNION
  SELECT preview_audio_url FROM user_works    WHERE preview_audio_url LIKE '%/artifacts/audio/%/a1.mp3'
) x WHERE u IS NOT NULL" > "$TMP/urls.txt" 2>/dev/null

total=$(wc -l < "$TMP/urls.txt")
echo "待迁文件: $total"
echo

while read -r url; do
  [ -z "$url" ] && continue
  key="artifacts/audio/${url##*/artifacts/audio/}"
  f="$TMP/dl.mp3"
  if ! rclone copyto "$BUCKET/$key" "$f" 2>/dev/null; then
    echo "  ❌ 取不到源文件: $key"; fail+=1; continue
  fi
  sz=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  if [ "${sz:-0}" -lt 4096 ]; then echo "  ❌ 文件太小疑似错误页($sz bytes): $key"; fail+=1; continue; fi
  sha=$(sha1sum "$f" | cut -c1-24)
  newkey="artifacts/audio/aud-${sha}.mp3"
  newurl="$CDN/$newkey"

  if [ "$newkey" = "$key" ]; then echo "  ⏭  已是哈希命名: $key"; skip+=1; continue; fi

  if [ "$APPLY" = 0 ]; then
    printf "  会迁: %-58s → aud-%s.mp3  (%s bytes)\n" "${key#artifacts/audio/}" "$sha" "$sz"
    ok+=1; continue
  fi

  # ① 复制到新地址(旧地址原样保留, 不动)
  if ! rclone copyto "$f" "$BUCKET/$newkey" 2>/dev/null; then
    echo "  ❌ 上传失败: $newkey"; fail+=1; continue
  fi
  # ② 校验: 新对象存在且大小一致 —— 校验通过才改库
  nsz=$(rclone lsl "$BUCKET/$newkey" 2>/dev/null | awk '{print $1}')
  if [ "${nsz:-0}" != "$sz" ]; then
    echo "  ❌ 新对象大小不符($nsz vs $sz), 不改库: $newkey"; fail+=1; continue
  fi
  # ③ 三张表一起改(旧文件仍在 R2 上, 任何时候可回退)
  "${PSQL[@]}" -q -c "
    UPDATE work_language_tracks SET audio_url='$newurl'        WHERE audio_url='$url';
    UPDATE user_works           SET preview_audio_url='$newurl' WHERE preview_audio_url='$url';
    UPDATE work_media_versions  SET url='$newurl'               WHERE url='$url';" 2>&1 | grep -i error && { fail+=1; continue; }
  printf "  ✅ %-58s → aud-%s.mp3\n" "${key#artifacts/audio/}" "$sha"
  ok+=1
done < "$TMP/urls.txt"

echo
echo "  成功 $ok · 跳过 $skip · 失败 $fail  (共 $total)"
[ "$APPLY" = 0 ] && echo "  ← 这是干跑。确认无误后加 --apply 真正执行。"
echo "  注意: 旧的 a1.mp3 **一个都没有删除**, 仍在 R2 上, 随时可回退。"
[ "$fail" -gt 0 ] && exit 1 || exit 0
