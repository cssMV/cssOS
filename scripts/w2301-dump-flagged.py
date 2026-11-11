#!/usr/bin/env python3
# 逐个人眼看 W2301 报出的那 17 处: 标题 · 疑似行全文 · 它在时间轴上占了多少秒。
# 只读。时间轴能证明【它真的被当歌词显示/对齐过】, 不只是文件里有一行脏数据。
import json, sys, re, statistics, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as f:
        return f.read()


def latin_ratio(s):
    t = re.sub(r"[\W_\d]+", "", s, flags=re.UNICODE)
    return (sum(1 for c in t if "a" <= c.lower() <= "z") / len(t)) if t else 0.0


addr = {}
for line in open("/tmp/w2301-addr.tsv"):
    f = line.rstrip("\n").split("\t")
    if len(f) >= 5:
        addr[(f[0], f[1], f[2], f[3])] = f[4].strip()

titles = {}
for line in open("/tmp/w2301-titles.tsv"):
    f = line.rstrip("\n").split("\t")
    if len(f) >= 2:
        titles[f[0]] = f[1]

for raw in open(sys.argv[1]):
    raw = raw.strip()
    if not raw:
        continue
    wid, lang, voice, take = raw.split("\t")
    u = addr.get((wid, lang, voice, take), "")
    doc = json.loads(get(u))
    ent = None
    for L in (doc.get("languages") or []):
        if str(L.get("lang", "")) == lang:
            ent = L
            break
    if ent is None and len(doc.get("languages") or []) == 1:
        ent = doc["languages"][0]

    # 正文行 + 每行的时间(从 tokens 的 t_start/t_end 毫秒推, 真源 app.emotion-subtitle-engine.js)
    recs = []
    for sec in (ent.get("sections") or []):
        for ln in (sec.get("lines") or []):
            txt = (ln.get("text") if isinstance(ln, dict) else str(ln)) or ""
            txt = txt.strip()
            if not txt or re.match(r"^\s*\[", txt):
                continue
            ts, te = None, None
            if isinstance(ln, dict):
                toks = ln.get("tokens") or []
                sts = [t.get("t_start") for t in toks if isinstance(t, dict) and t.get("t_start") is not None]
                ets = [t.get("t_end") for t in toks if isinstance(t, dict) and t.get("t_end") is not None]
                if sts: ts = min(sts) / 1000.0
                if ets: te = max(ets) / 1000.0
                if ts is None and ln.get("t_start") is not None: ts = ln["t_start"] / 1000.0
                if te is None and ln.get("t_end") is not None: te = ln["t_end"] / 1000.0
            recs.append((txt, ts, te))

    body = [r[0] for r in recs]
    med = statistics.median(len(b) for b in body) if body else 0
    bad = [r for r in recs if len(r[0]) > med * 3 and latin_ratio(r[0]) > 0.90]

    print("=" * 100)
    print("%s  %s/%s ♪%s" % (wid, lang, voice, take))
    print("标题: %s" % titles.get(wid, "(查不到)"))
    print("正文 %d 行 · 中位行长 %.0f · 疑似 %d 行" % (len(body), med, len(bad)))
    allend = [r[2] for r in recs if r[2] is not None]
    print("字幕整体: %.1f → %.1fs" % (
        min([r[1] for r in recs if r[1] is not None], default=-1),
        max(allend, default=-1)))
    for txt, ts, te in bad:
        span = ("%.1f→%.1fs (%.1fs)" % (ts, te, te - ts)) if (ts is not None and te is not None) else "无时间轴"
        print("  【%s】 %s" % (span, txt[:300]))
    print()
