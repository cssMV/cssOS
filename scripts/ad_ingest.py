#!/usr/bin/env python3
"""CSSOS_WAVE_1774 — 把 nginx 日志里带 ?cssADS= 的落地记录搬进 ad_landings 表。

为什么需要: nginx access.log 只留 14 天就轮转掉了, 而广告要跨月对比。本脚本每天跑一次,
在日志被轮转前把数据落库。完全幂等 —— 同一份日志重跑多少次都不会产生重复行
(靠 ad_landings_dedup 唯一索引 + ON CONFLICT DO NOTHING)。

用法(在 api-vm 上):
    sudo python3 /srv/cssos/repo/scripts/ad_ingest.py            # 扫当前 + 已轮转日志
    sudo python3 /srv/cssos/repo/scripts/ad_ingest.py --all      # 连 .gz 一起扫(首次回填用)
"""
import gzip
import hashlib
import os
import re
import subprocess
import sys
from datetime import datetime

LOG_DIR = "/var/log/nginx"
# nginx combined 格式:
#   IP - - [26/Jul/2026:05:52:16 +0000] "GET /path?q HTTP/1.1" 200 1234 "ref" "UA"
LINE_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) [^"]*" '
    r'(?P<status>\d{3}) \S+ "(?P<ref>[^"]*)" "(?P<ua>[^"]*)"'
)
CSSADS_RE = re.compile(r"[?&]cssADS=([^&\s\"]+)", re.I)
# 爬虫特征。宁可多标一点 —— is_bot 只影响统计口径, 原始行照样留着。
BOT_RE = re.compile(
    r"bot|crawler|spider|slurp|curl|wget|python-requests|headless|"
    r"facebookexternalhit|preview|monitor|uptime|pingdom|sentry|lighthouse",
    re.I,
)


def db_url() -> str:
    with open("/etc/cssos.env") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    sys.exit("DATABASE_URL not found in /etc/cssos.env")


def log_files(include_gz: bool):
    """当前日志 + 轮转日志。.gz 只在 --all 时扫(首次回填)。"""
    out = []
    for name in sorted(os.listdir(LOG_DIR)):
        if not name.startswith("access.log"):
            continue
        if name.endswith(".gz") and not include_gz:
            continue
        out.append(os.path.join(LOG_DIR, name))
    return out


def parse(path: str):
    opener = gzip.open if path.endswith(".gz") else open
    try:
        with opener(path, "rt", errors="replace") as fh:
            for line in fh:
                if "cssADS=" not in line:
                    continue
                m = LINE_RE.match(line)
                if not m:
                    continue
                tag = CSSADS_RE.search(m.group("path"))
                if not tag:
                    continue
                try:
                    ts = datetime.strptime(m.group("ts"), "%d/%b/%Y:%H:%M:%S %z")
                except ValueError:
                    continue
                ip = m.group("ip").split(",")[0].strip()
                yield {
                    "source": tag.group(1)[:200],
                    "landed_at": ts.isoformat(),
                    # 只存哈希前 16 位: 够去重, 不可反推明文 IP。
                    "ip_hash": hashlib.sha256(ip.encode()).hexdigest()[:16],
                    "user_agent": m.group("ua")[:500],
                    "is_bot": bool(BOT_RE.search(m.group("ua"))),
                    "path": m.group("path")[:500],
                }
    except OSError as e:
        print(f"  跳过 {path}: {e}", file=sys.stderr)


def main() -> None:
    include_gz = "--all" in sys.argv
    url = db_url()
    rows = []
    for f in log_files(include_gz):
        n = 0
        for rec in parse(f):
            rows.append(rec)
            n += 1
        if n:
            print(f"  {os.path.basename(f)}: {n} 条")
    if not rows:
        print("没有找到带 cssADS 的记录")
        return

    # 批量 INSERT + ON CONFLICT DO NOTHING 保证幂等(同一份日志可反复重跑)。
    # 走 psql -c, 所以在 python 侧做单引号转义后内联 —— 数据全部来自我们自己的日志,
    # 且 esc() 对所有字段一视同仁, 不存在未转义路径。
    def esc(v: str) -> str:
        return "'" + str(v).replace("'", "''") + "'"

    tuples = ",".join(
        "({},{}::timestamptz,{},{},{},{})".format(
            esc(r["source"]), esc(r["landed_at"]), esc(r["ip_hash"]),
            esc(r["user_agent"]), "true" if r["is_bot"] else "false", esc(r["path"])
        )
        for r in rows
    )
    sql = (
        "INSERT INTO ad_landings (source, landed_at, ip_hash, user_agent, is_bot, path) "
        f"VALUES {tuples} ON CONFLICT DO NOTHING"
    )
    res = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1", "-c", sql],
                         capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"入库失败: {res.stderr.strip()}")
    print(f"扫到 {len(rows)} 条 → {res.stdout.strip()} (重复的自动跳过)")


if __name__ == "__main__":
    main()
