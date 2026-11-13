#!/usr/bin/env python3
# W2308 第二步 —— 那 20 个「修前会被唱出来」的作品里, 哪些【已经发作】:
# 线上字幕里真留着那些说明行。只读, 不写, 不重做任何东西。
#
# 判法照 W2303 的教训: 拿【修前 vs 修后的解析结果之差】当针, 不在成品字幕上按关键词找 ——
# 字幕管线会把 `[Instrumentation: ` 这类前缀剥掉, 剥完读起来就像一句歌词,
# 按 `Prompt:` / `Instrumentation:` 扫, 20 行只能抓到还留着前缀的 10 行。
#
# 比较一律在【去掉全部空白】的形式上做, 因为字幕是逐字 token, 回拼时空格未必还原;
# 既比「整行相等」也比「字幕行包含针」(前缀被剥掉的情形)。
import json, os, re, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
CDN = "https://cdn.cssstudio.app"
NEEDLES = sys.argv[1] if len(sys.argv) > 1 else "/tmp/w2308-needles.json"
MINLEN = 12          # 太短的行(语气词/单词)当针会误命中, 一律不当针


def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A",
                        "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=180)
    if r.returncode:
        print("   SQL FAIL %s" % r.stderr[:200]); return None
    return r.stdout.strip()


def fetch(u):
    if not u: return None
    if u.startswith("/"): u = CDN + u
    if not u.startswith("http"): u = "%s/%s" % (CDN, u.lstrip("/"))
    try:
        return json.loads(urllib.request.urlopen(urllib.request.Request(
            u, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8", "replace"))
    except Exception:
        return None


def sub_lines(doc):
    """把一份字幕 JSON 回拼成【行文本】列表。tokens 用 char(真源字段名, 不猜)。"""
    out = []
    if not isinstance(doc, dict): return out
    for ent in (doc.get("languages") or []):
        tag = str(ent.get("lang") or "")
        for sec in (ent.get("sections") or []):
            for ln in (sec.get("lines") or []):
                txt = ln.get("text")
                if not txt:
                    txt = "".join(str(t.get("char") or "") for t in (ln.get("tokens") or []))
                out.append((tag, str(txt or "")))
    return out


sq = lambda s: re.sub(r"\s+", "", str(s or ""))

# ── 自检: 先在【已知答案】上校准, 再去扫库 ───────────────────────────────────
# W2301 那几条受害者的字幕 2026-11-12 已经重做干净, 所以线上【没有】现成的阳性样本可校。
# 于是用针自己造一份阳性字幕文档: 一行放针(逐字 token, 和真字幕同构, 还故意剥掉前缀
# 模拟字幕管线的行为), 一行放无关歌词。必须正好命中 1 处, 否则这把尺子不能用。
def selftest(needle):
    mk = lambda t: {"tokens": [{"char": c} for c in t]}
    doc = {"languages": [{"lang": "en", "sections": [{"lines": [
        mk(needle), mk("A line that is certainly not the needle at all")]}]}]}
    lines = sub_lines(doc)
    if len(lines) != 2:
        print("‼ 自检: 回拼出 %d 行, 应为 2 —— 尺子不能用" % len(lines)); sys.exit(2)
    ns = sq(needle)
    hit = sum(1 for _, t in lines if sq(t) == ns or (len(ns) >= 16 and ns in sq(t)))
    if hit != 1:
        print("‼ 自检: 命中 %d 处, 应为 1 —— 尺子不能用" % hit); sys.exit(2)
    # 反向: 针与无关行不许互相命中
    other = sq("A line that is certainly not the needle at all")
    if other == ns or (len(ns) >= 16 and ns in other) or (len(other) >= 16 and other in ns):
        print("‼ 自检: 无关行也命中了 —— 尺子太松, 不能用"); sys.exit(2)
    print("自检 ✅ 针在阳性文档里命中 1 处, 无关行不命中\n")


works = json.load(open(NEEDLES, encoding="utf-8"))
_cal = next((n for w in works for n in w.get("removed", []) if len(sq(n)) >= 20), None)
if not _cal:
    print("‼ 没有够长的针可做自检 —— 判不了"); sys.exit(2)
selftest(_cal)
print("清单 %d 个作品(修前会被唱出来的行 = 针)\n" % len(works))

tot_hit = tot_files = unjudge = 0
report = []
for w in works:
    wid, title = w["id"], str(w.get("title") or "")[:40]
    needles = [n for n in w.get("removed", []) if len(sq(n)) >= MINLEN]
    if not needles:
        print("[%s] %s —— 没有够长的针(全是短行), 跳过" % (wid[:8], title)); continue
    urls = set()
    for row in (q("SELECT COALESCE(subtitle_take1_json_url,'') FROM user_works WHERE id='%s'::uuid;" % wid) or "").split("\n"):
        if row.strip(): urls.add(row.strip())
    for tbl, col in (("work_language_tracks", "subtitle_url"), ("work_media_versions", "subtitle_url")):
        r = q("SELECT DISTINCT %s FROM %s WHERE work_id='%s'::uuid AND %s IS NOT NULL AND %s<>'';"
              % (col, tbl, wid, col, col))
        if r is None: unjudge += 1; continue
        for row in r.split("\n"):
            if row.strip(): urls.add(row.strip())
    # 作品级常规地址(库里没记时也试一次)
    urls.add("works/%s/subtitle-take1.json" % wid)

    hits, files, miss = [], 0, 0
    for u in sorted(urls):
        doc = fetch(u)
        if doc is None: miss += 1; continue
        files += 1
        lines = sub_lines(doc)
        for n in needles:
            ns = sq(n)
            for tag, txt in lines:
                t = sq(txt)
                if not t: continue
                if t == ns or (len(ns) >= 16 and ns in t) or (len(t) >= 16 and t in ns):
                    hits.append((u.rsplit("/", 1)[-1], tag, n[:70])); break
    tot_files += files
    flag = "‼ 已发作" if hits else "干净"
    print("[%s] %s  针 %d · 字幕文件 %d(读不到 %d) → %s"
          % (wid[:8], title, len(needles), files, miss, flag))
    for h in hits[:6]:
        print("        %-42s [%s] %s" % (h[0][:42], h[1], h[2]))
    if hits: report.append((wid, title, len(hits), sorted({h[0] for h in hits})))
    tot_hit += len(hits)

print("\n" + "=" * 92)
print("已发作的作品: %d" % len(report))
for wid, title, n, fs in report:
    print("  ‼ %s %s —— %d 处, 落在 %s" % (wid[:8], title, n, ", ".join(f[:34] for f in fs)))
print("共扫字幕文件 %d · 命中 %d 处 · 判不了 %d" % (tot_files, tot_hit, unjudge))
print("VERDICT: W2308-live-scan 结束(已发作 %d / 判不了 %d)" % (len(report), unjudge))
