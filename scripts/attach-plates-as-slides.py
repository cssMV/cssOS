#!/usr/bin/env python3
# CSSOS_WAVE_2023 — 把【已经存在的锚图】注册成幻灯素材(一次性回填)。
# 新拍的不用跑这个 —— mv-plate 带 work_id 就会自动挂。
import json, os, subprocess

dbu = subprocess.run(
    'sudo grep -E "^DATABASE_URL=" /etc/cssos.env | head -1 | cut -d= -f2- | tr -d \'"\'',
    shell=True, capture_output=True, text=True).stdout.strip()

MAP = {
    "/srv/cssos/tmp/rumi-v2-plates.json": [
        "c9e2f4a8-1b73-4d56-8f09-7e2a3b4c5d68", "d0f3a5b9-2c84-4e67-9a10-8f3b4c5d6e79",
        "e1a4b6c0-3d95-4f78-8b21-9a4c5d6e7f80", "f2b5c7d1-4e06-4a89-9c32-0b5d6e7f8a91"],
    "/srv/cssos/tmp/sappho-plates.json": [
        "a1b2c3d4-5e6f-4a70-8b91-2c3d4e5f6a71", "b2c3d4e5-6f70-4b81-9c02-3d4e5f6a7b82",
        "c3d4e5f6-7081-4c92-8d13-4e5f6a7b8c93", "d4e5f607-8192-4da3-9e24-5f6a7b8c9da4"],
}

SQL = ("INSERT INTO work_assets (work_id, asset_type, url, meta) "
       "SELECT $1::uuid, 'slideshow_frame', $2, '{\"derived_from\":\"mv_plate_backfill\"}'::jsonb "
       "WHERE NOT EXISTS (SELECT 1 FROM work_assets WHERE work_id=$1::uuid AND url=$2) "
       "RETURNING 1")

n = 0
for f, wids in MAP.items():
    if not os.path.exists(f):
        print("跳过(文件不在)", f); continue
    plates = list(json.load(open(f)).values())
    for wid in wids:
        for u in plates:
            r = subprocess.run(["psql", dbu, "-tA", "-c",
                                SQL.replace("$1", "'" + wid + "'").replace("$2", "'" + u + "'")],
                               capture_output=True, text=True)
            if r.returncode != 0:
                print("  ! ", r.stderr.strip()[:120])
            n += 1

# 汇总【问数据库要】, 不去解析 psql 的 stdout —— 第一版就是靠解析 stdout 计数,
# 结果实际写进 12 条却报告"0 条"。一个和事实对不上的汇总, 比没有汇总更糟:
# 我差点据此以为回填没生效, 又去跑一遍。
real = subprocess.run(["psql", dbu, "-tA", "-c",
    "SELECT count(*) FROM work_assets WHERE asset_type='slideshow_frame' "
    "AND meta->>'derived_from'='mv_plate_backfill'"], capture_output=True, text=True).stdout.strip()
print("尝试写入 %d 次, 库里实际有 %s 条(去重后)" % (n, real))
