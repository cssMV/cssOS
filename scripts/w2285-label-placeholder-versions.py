#!/usr/bin/env python3
"""W2285 —— 给那 125 条【占位音版本行】补上标签。

为什么要补: 这些行是 2026-06-04 那批占位音(30/60 秒)在 work_media_versions 里的登记,
label 是空的。W2285 把母语轨换成真音乐之后, 版本胶囊里会并排出现两三条, 其中一条没名字 ——
用户看不出它是什么。宗旨本来就是「让用户在胶囊里认得出哪一版是哪一版」。

只改 label, 一个字节的媒体都不动, 也不碰 is_current:
  · 只改 kind='audio' 且 url 在 artifacts/mv-fallback/ 下、且 label 为空的行
  · 一行一条 UPDATE, 带 url 二次匹配
  · 默认干跑, 真写必须 --apply
  · 每条回读 —— 唯一可信的判据是回读, 不看 psql 打的命令标签
    (`-q` 是 quiet, 它把 "UPDATE 1" 整个吞掉; W2282 回填第一版就栽在这上面:
     638 行其实全写进去了, 脚本却逐行报失败, 于是一条都没验。)
旧值是 NULL / 空串, 没有东西可丢, 所以不另建备份表。

用法: python3 -I scripts/w2285-label-placeholder-versions.py [--apply]
"""
import os, subprocess, sys

APPLY = "--apply" in sys.argv
LABEL = "占位(2026-06-04)"


def dburl():
    env = os.environ.get("DATABASE_URL")
    if env:
        return env
    try:
        for ln in open("/etc/cssos.env"):
            ln = ln.strip()
            if ln.startswith("DATABASE_URL="):
                return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    sys.exit("FAIL: 找不到 DATABASE_URL")


DB = dburl()


def psql(sql):
    r = subprocess.run(["psql", DB, "-X", "-q"],
                       input="\\pset format unaligned\n\\pset tuples_only on\n" + sql,
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit("FAIL: psql " + r.stderr[:300])
    return r.stdout


rows = [l for l in psql(
    "SELECT id||'|'||url FROM work_media_versions "
    "WHERE kind='audio' AND url LIKE '%/artifacts/mv-fallback/%' "
    "  AND coalesce(label,'')='' ORDER BY id;").strip().split("\n") if l.strip()]
print("没有标签的占位音版本行: %d 条%s" % (len(rows), "  [--apply 真写]" if APPLY else "  [干跑]"))
if not rows:
    sys.exit(0)

ok = bad = 0
for ln in rows:
    vid, url = ln.split("|", 1)
    if not APPLY:
        ok += 1
        continue
    # URL 里不含单引号(已全库核过), 这里仍用 $$ 引用避免任何转义问题
    sql = ("UPDATE work_media_versions SET label=$$%s$$ "
           "WHERE id=%s AND coalesce(label,'')='' AND url=$$%s$$" % (LABEL, vid, url))
    up = subprocess.run(["psql", DB, "-X", "-c", sql], capture_output=True, text=True)
    if up.returncode:
        print("  FAIL 行%s: %s" % (vid, up.stderr[:140]))
        bad += 1
        continue
    back = psql("SELECT coalesce(label,'') FROM work_media_versions WHERE id=%s;" % vid).strip()
    if back != LABEL:
        print("  FAIL 行%s 回读是 '%s'" % (vid, back))
        bad += 1
        continue
    ok += 1

print("汇总: 清单 %d · 改好 %d · 不过 %d%s" % (len(rows), ok, bad, "  [干跑]" if not APPLY else ""))
if ok + bad != len(rows):
    sys.exit("FAIL: 账对不上")
sys.exit(1 if bad else 0)
