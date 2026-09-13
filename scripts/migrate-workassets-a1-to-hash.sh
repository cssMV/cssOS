#!/bin/bash
# W2091 — 收尾迁移: work_assets 里残留的 <workId>/a1.mp3
#   A. 该作品已有哈希音频 → 只改指针(15 条)
#   B. 该作品从未迁过(无 work_language_tracks 行) → 复制 a1.mp3 → aud-<sha24>.mp3 再改指针
# 【旧文件一个都不删】—— 删字节正是要避免的事。
set -u
APPLY="${1:-}"
PS=(env PGPASSWORD=Au#20016 psql -h 127.0.0.1 -U cssstudio -d cssstudio -tAc)
B=r2:cssos-artifacts
say(){ [ "$APPLY" = "--apply" ] && echo "[做] $*" || echo "[干跑] $*"; }

# ── A: 已有哈希音频的, 改指针
"${PS[@]}" "
SELECT a.id||'|'||t.audio_url FROM work_assets a
 JOIN LATERAL (SELECT audio_url FROM work_language_tracks
                WHERE work_id=a.work_id AND audio_url LIKE '%/aud-%' LIMIT 1) t ON true
 WHERE a.url LIKE '%/a1.mp3'" | while IFS='|' read -r aid newurl; do
  [ -z "$aid" ] && continue
  say "A 改指针 asset#$aid → ${newurl##*/}"
  [ "$APPLY" = "--apply" ] && "${PS[@]}" "UPDATE work_assets SET url='$newurl' WHERE id='$aid'" >/dev/null
done

# ── B: 从未迁过的, 先复制文件再改指针
"${PS[@]}" "
SELECT a.id||'|'||a.work_id||'|'||a.url FROM work_assets a
 WHERE a.url LIKE '%/a1.mp3'
   AND NOT EXISTS (SELECT 1 FROM work_language_tracks t
                    WHERE t.work_id=a.work_id AND t.audio_url LIKE '%/aud-%')" | while IFS='|' read -r aid wid url; do
  [ -z "$aid" ] && continue
  key="artifacts/audio/$wid/a1.mp3"
  tmp=$(mktemp /tmp/a1XXXX.mp3)
  rclone copyto "$B/$key" "$tmp" 2>/dev/null || { echo "  ❌ 取不到 $key"; rm -f "$tmp"; continue; }
  sha=$(sha1sum "$tmp" | cut -c1-24)
  nk="artifacts/audio/aud-$sha.mp3"
  nu="https://cdn.cssstudio.app/$nk"
  say "B 复制 $key → $nk ($(stat -c%s "$tmp") 字节) 并改指针 asset#$aid"
  if [ "$APPLY" = "--apply" ]; then
    rclone copyto "$tmp" "$B/$nk" 2>/dev/null \
      && "${PS[@]}" "UPDATE work_assets SET url='$nu' WHERE id='$aid'" >/dev/null \
      && echo "     ✅ 完成(旧文件保留)"
  fi
  rm -f "$tmp"
done
