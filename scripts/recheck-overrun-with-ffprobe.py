#!/usr/bin/env python3
"""复核 OVERRUN —— 分母换成【ffprobe 实测】, 不信库里的 duration_secs。(W2275, 2026-11-06)

为什么必须复核: audit-take-subtitles.py 的 OVERRUN 判据写着
    dur = tk.get("duration_secs")     # 来自接口 → 来自库
一旦那一列短了, 一份【完全正确】的字幕也会被判成超出。
实测撞上过 4 条: 雅典娜 zh 库里记 192s / 实解 261.9s, 字幕末尾 242.7s —— 其实绰绰有余。
「时长为空就不判」那一支已经有了(DUR_UNKNOWN), 但【时长写错】这一支一直没人管,
而写错比为空更危险: 为空会老实说判不了, 写错会理直气壮地报错。

只读, 一个字不写。
"""
import os, sys, json, subprocess, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
HERE = os.environ.get("CSSOS_SCRIPTS", "/Users/cssos/cssOS/scripts")
def extract(path, start, stop, needs):
    src = open(path, encoding="utf-8").read()
    a = src.index(start); b = src.index(stop, a); blk = src[a:b]
    for n in needs:
        if n not in blk: sys.exit(f"FAIL: 没能从 {path} 抽出 {n!r} —— 文件结构变了")
    return blk
G = {}
exec("import sys, os, json, urllib.request, collections\n_cache={}\n" + extract(
      os.path.join(HERE, "audit-take-subtitles.py"), "UA   = {", "# ── 自检",
      ["def get(u)", "def sub_url(tr, take)", "def ends(entry)"]).replace("UA   = {", "UA = {"), G)
get, sub_url, ends = G["get"], G["sub_url"], G["ends"]

findings = json.load(open(os.environ.get("W2275_AUDIT", "/tmp/audit-w2275-after.json")))
rows = findings if isinstance(findings, list) else (findings.get("findings") or [])
ov = [r for r in rows if r["kind"] == "OVERRUN"]
print(f"OVERRUN 清单 {len(ov)} 条, 逐条 ffprobe 实测分母")
API = "https://cssstudio.app"

def probe(u):
    try:
        p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=nw=1:nk=1", u], capture_output=True, text=True, timeout=180)
        v = float((p.stdout or "0").strip() or 0)
        return v if v > 0 else None
    except Exception:
        return None

def do(r):
    wid = r["work"]; who = r.get("track") or ""; take = int(str(r.get("take") or "♪1").lstrip("♪"))
    lang = who.split("/")[0]; voice = who.split("/")[1] if "/" in who else "auto"
    d = get(f"{API}/api/works/{wid}/language-tracks")
    if "__err" in d: return ("取不到接口", r, None, None, None)
    tr = next((t for t in (d.get("tracks") or [])
               if str(t.get("lang") or "") == lang and str(t.get("voice") or "auto") == voice), None)
    if not tr: return ("接口里找不到这条轨", r, None, None, None)
    tks = tr.get("takes") or []
    tk = tks[take - 1] if len(tks) >= take else None
    if not tk: return ("接口里找不到这一版", r, None, None, None)
    url = str(tk.get("url") or "")
    db = tk.get("duration_secs")
    u, via = sub_url(tr, take)
    if u.startswith("/"): u = API + u
    doc = get(u)
    if "__err" in doc: return ("字幕取不到", r, db, None, None)
    e = next((x for x in (doc.get("languages") or []) if x.get("lang") == lang), None)
    if e is None: return ("文件里没这条语言", r, db, None, None)
    s, a, n = ends(e)
    real = probe(url if not url.startswith("/") else API + url)
    if real is None: return ("ffprobe 失败", r, db, None, s)
    return ("真超出" if s - real > 5.0 else "假阳性(库里时长写短了)", r, db, real, s)

res = []
with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(do, ov))
cnt = collections.Counter(x[0] for x in res)
print()
for k, v in cnt.most_common(): print(f"  {k}: {v}")
print("\n假阳性明细(库里时长 vs 实测):")
for kind, r, db, real, s in res:
    if kind.startswith("假阳性"):
        print(f"  {r['work'][:8]} {r.get('track'):16s} {r.get('take')} 字幕末尾{s}s  库里{db}s → 实测{real:.1f}s  {r.get('title','')[:26]}")
print("\n真超出明细:")
for kind, r, db, real, s in sorted((x for x in res if x[0] == "真超出"), key=lambda x: -(x[4] - x[3])):
    print(f"  {r['work'][:8]} {r.get('track'):16s} {r.get('take')} 字幕末尾{s}s 实测音频{real:.1f}s 超{s-real:.1f}s  {r.get('title','')[:26]}")
bad = [x for x in res if x[0] not in ("真超出",) and not x[0].startswith("假阳性")]
if bad:
    print(f"\n判不了 {len(bad)} 条(这【不是】『对』):")
    for kind, r, *_ in bad: print(f"  {kind}: {r['work'][:8]} {r.get('track')} {r.get('take')}")
json.dump([dict(verdict=k, work=r["work"], track=r.get("track"), take=r.get("take"),
                title=r.get("title"), sub_end=s, db_dur=db, real_dur=real)
           for k, r, db, real, s in res], open("/tmp/w2275-overrun-recheck.json", "w"),
          ensure_ascii=False, indent=1)
print("\n→ /tmp/w2275-overrun-recheck.json")
