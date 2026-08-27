#!/usr/bin/env bash
# CSSOS_WAVE_1995 20260827 — 《王维·辋川三部曲》上线: 三条视频轨挂到作品上并标真视频。
#
# 在 api-vm 上跑。走平台既有的 /api/admin/mark-real-video-mv —— 它会把
# is_real_video_mv 【向上传播到树根】(W1970b), 否则整部作品在市场列表里不冒头。
set -euo pipefail
TOK=$(sudo grep -E "^CSSOS_ADMIN_TOKEN=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"')
CDN=https://cdn.cssstudio.app/artifacts/mv

mark () {  # $1 work_id  $2 mp4 basename  $3 label
  echo -n "$3: "
  curl -s -m 120 -X POST "http://127.0.0.1:3000/api/admin/mark-real-video-mv/$1" \
    -H "x-admin-token: $TOK" -H "content-type: application/json" \
    -d "{\"video_url\":\"$CDN/$2\"}" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
print("✅ 已标真视频, 根节点=" + str(d.get("promoted_root"))[:8] if d.get("ok") else "❌ " + str(d)[:160])'
}

mark b1d2f3a4-5c6e-4780-9a1b-2c3d4e5f6071 wangchuan-p1-kongshanxinyu-realvideo.mp4 "第一部 空山新雨"
mark c2e3a4b5-6d7f-4891-8b2c-3d4e5f607182 wangchuan-p2-zhuliguan-realvideo.mp4     "第二部 竹里馆"
mark d3f4b5c6-7e80-49a2-9c3d-4e5f60718293 wangchuan-p3-luzhai-realvideo.mp4        "第三部 鹿柴"

echo
echo "--- 核对 ---"
DBU=$(sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d '"')
psql "$DBU" -c "SELECT left(w.title,28) AS title, u.email AS owner, w.is_real_video_mv AS real,
       w.duration_secs AS dur, right(w.preview_video_url,42) AS video
  FROM user_works w JOIN users u ON u.id=w.user_id
 WHERE w.id='a7c1e5d2-9b3f-4e18-8a06-2f4d7c1b9e30'
    OR w.root_work_id='a7c1e5d2-9b3f-4e18-8a06-2f4d7c1b9e30'
 ORDER BY w.sequence_index;"
