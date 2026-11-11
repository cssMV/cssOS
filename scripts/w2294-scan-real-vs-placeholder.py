#!/usr/bin/env python3
"""把 audit-take-subtitles.py --all --deep --json 的结果分成
【真问题】与【被保留的占位音造成的假警报】。只读, 一个字不写。

── 为什么需要这一层 ─────────────────────────────────────────────────────
全库巡检(2026-11-11)原始输出 OVERRUN 232 个作品 / 256 处。但最狠的那些写着
「超出音频 60s」「超出音频 30s」—— 那不是歌, 那是 W2285/W2290 替换占位音时
【按版本铁律保留下来的占位音版本行】(正好 125 条, 就是被替换掉的那 125 个)。
它们 subtitle_url 为空 → 回退到作品级字幕 → 一首 390s 的字幕对上一段 60s 的
占位音, 被判成「越界 330s」。

占位音不是任何人会播的版本, 它留着只因为【旧字节必须有自己的地址】(W2061)。
给它重做字幕只会得到一条 30 秒的字幕, 还会让它看起来像一个真 take。
所以这 125 处必须剔掉 —— 不剔, 规模就报大了一倍(我差点就那么报了)。

判据【不靠猜时长】: 从库里取出所有 mv-fallback 版本行的 (work_id, duration_secs),
按这两项匹配。匹配不上的一律算真问题 —— 宁可多报, 不漏报。
(不能只按「时长 ≤ 90s」判: 真有短作品, 那样会把真问题当假警报扔掉。)

用法: python3 -I scripts/w2294-scan-real-vs-placeholder.py <scan.json> "$DATABASE_URL"
      CALIBRATE=1 ...   # 校准: 假装库里没有占位音行, OVERRUN 真问题数必须涨回原始值。
                        #       涨不回去 = 这个过滤器根本没在起作用。
"""
import collections, json, os, re, statistics, subprocess, sys

if len(sys.argv) < 3:
    sys.exit("用法: w2294-scan-real-vs-placeholder.py <scan.json> <DATABASE_URL>")
CAL = os.environ.get("CALIBRATE") == "1"
scan = json.load(open(sys.argv[1], encoding="utf-8"))
f = scan.get("findings") or []
if not f:
    sys.exit("findings 是空的 —— 判不了(不是『全库没问题』)")

ph = collections.defaultdict(set)
nph = 0
if CAL:
    print("⚠ CALIBRATE=1 —— 假装库里没有占位音版本行, 真问题数必须涨回原始值")
else:
    sql = ("SELECT work_id::text || '|' || coalesce(duration_secs,0) FROM work_media_versions "
           "WHERE kind='audio' AND url LIKE '%/artifacts/mv-fallback/%';")
    out = subprocess.run(["psql", sys.argv[2], "-X", "-q", "-t", "-A", "-c", sql],
                         capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("查不到占位音版本行 —— 判不了, 不出数:\n" + out.stderr[:300])
    for line in out.stdout.splitlines():
        if "|" not in line:
            continue
        w, d = line.rsplit("|", 1)
        ph[w].add(int(d)); nph += 1
    print(f"库里占位音版本行 {nph} 条, 分布在 {len(ph)} 个作品")

def aud_s(note):
    m = re.search(r"超出音频([0-9.]+)s", note or "")
    return int(float(m.group(1))) if m else None

def over_s(note):
    m = re.search(r"共([0-9.]+)s", note or "")
    return float(m.group(1)) if m else None

real, fake, unknown = [], [], []
for x in f:
    if x.get("kind") != "OVERRUN":
        real.append(x); continue
    a = aud_s(x.get("note"))
    if a is None:
        unknown.append(x); continue          # 取不到 ≠ 没有 —— 单列, 不算进任何一边
    (fake if a in ph.get(x.get("work") or "", set()) else real).append(x)

ov_real = [x for x in real if x.get("kind") == "OVERRUN"]
ov_all = [x for x in f if x.get("kind") == "OVERRUN"]
print()
print(f"OVERRUN 原始 {len(ov_all)} 处 → 占位音假警报 {len(fake)} 处 · 真问题 {len(ov_real)} 处"
      + (f" · 音频秒数取不到 {len(unknown)} 处(单列)" if unknown else ""))

if CAL:
    if len(ov_real) == len(ov_all) and not fake:
        print("校准通过: 没有占位音行时, 一处都不被剔掉"); sys.exit(0)
    print(f"FAIL 校准失败: 库里没有占位音行, 却还剔掉了 {len(fake)} 处 —— 过滤器在凭别的东西判")
    sys.exit(3)

print()
print("=== 剔掉假警报之后的真实规模 ===")
byk, cnt = collections.defaultdict(set), collections.Counter()
for x in real:
    byk[x.get("kind")].add(x.get("work")); cnt[x.get("kind")] += 1
for k, s in sorted(byk.items(), key=lambda kv: -len(kv[1])):
    print(f"  {k:11} {len(s):>4} 个作品 · {cnt[k]:>4} 处")
print(f"  —— 合计 {len(set(x.get('work') for x in real))} 个作品 / 全库 {scan.get('judged')} 个")

vals = [v for v in (over_s(x.get("note")) for x in ov_real) if v is not None]
if vals:
    print()
    print("=== 真 OVERRUN 超出多少秒 ===")
    for lo, hi in [(0, 5), (5, 15), (15, 30), (30, 60), (60, 120), (120, 10 ** 9)]:
        c = sum(1 for v in vals if lo <= v < hi)
        lab = f"{lo}-{hi}s" if hi < 10 ** 9 else f">{lo}s"
        print(f"  {lab:>9}  {c:>4} 处  {'#' * min(50, c)}")
    print(f"  中位 {statistics.median(vals):.0f}s · 最大 {max(vals):.0f}s")
    print("  按 ♪:", dict(collections.Counter(x.get("take") for x in ov_real)))
