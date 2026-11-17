#!/usr/bin/env bash
# W2338 回填 — 把 W2332 建的那批轨的 status 补成 'ready'。
#
# 为什么要回填: W2332(2026-11-15)那条 INSERT 漏了 status 这一列。代码已在 W2338 修好,
# 但【已经建出来的那些行】还带着默认值, 所以:
#   · resubtitle / GET /language-tracks 看得见它们(不过滤 status)→ 字幕是好的
#   · available_langs / 多语言胶囊 / "默认轨"权威查询看不见(过滤 status='ready')
#     → 轨建了、字幕有了、胶囊里却是空的
#
# 判据刻意收紧 —— 只碰【确实已经就绪】的那种行, 绝不把真正 pending/failed 的翻成 ready:
#   · audio_url 是我们自己域名上的活链(cdn.cssstudio.app)
#   · 当前 status 是 NULL 或 'pending'(failed 一律不碰 —— 它失败是有原因的)
#   · 挂在【多部作品的叶子】上(有 root_work_id 且 structure_role 是分部类)
#
# 默认干跑, 只打印会改什么。真改要显式 --apply。
#   bash scripts/w2338-backfill-track-status.sh            # 干跑
#   bash scripts/w2338-backfill-track-status.sh --apply    # 真改
set -euo pipefail
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

SQL_WHERE="
    t.audio_url LIKE '%cdn.cssstudio.app%'
    AND (t.status IS NULL OR t.status = 'pending')
    AND w.root_work_id IS NOT NULL
    AND w.structure_role IN ('part','scene','episode','take2','theme_song','interlude','ending_song')
"

if [ "$APPLY" = "0" ]; then
  echo "── 干跑: 以下行【会】被改成 status='ready' ──────────────────"
  bash "$(dirname "$0")/db.sh" "
    SELECT t.id, w.title, w.structure_role AS role, w.sequence_index AS seq,
           t.lang, coalesce(t.status,'(null)') AS status_now
      FROM work_language_tracks t
      JOIN user_works w ON w.id = t.work_id
     WHERE $SQL_WHERE
     ORDER BY w.root_work_id, w.sequence_index, t.track_order"
  echo
  echo "条数:"
  bash "$(dirname "$0")/db.sh" "
    SELECT count(*) AS would_change
      FROM work_language_tracks t JOIN user_works w ON w.id = t.work_id
     WHERE $SQL_WHERE"
  echo
  echo "要真改请加 --apply"
  exit 0
fi

echo "── 真改 ──────────────────────────────────────────────────"
bash "$(dirname "$0")/db.sh" "
  UPDATE work_language_tracks t SET status='ready', updated_at=now()
    FROM user_works w
   WHERE w.id = t.work_id AND $SQL_WHERE"
echo
echo "── 回读核对(应为 0 条残留)────────────────────────────────"
# 改完必须回读 —— 编出来的条件形状合法也可能影响 0 行, 脚本照样打印成功。
bash "$(dirname "$0")/db.sh" "
  SELECT count(*) AS still_not_ready
    FROM work_language_tracks t JOIN user_works w ON w.id = t.work_id
   WHERE $SQL_WHERE"
