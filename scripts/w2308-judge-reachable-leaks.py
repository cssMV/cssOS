#!/usr/bin/env python3
# W2308 第三步 —— 那 15 个「字幕里真留着说明行」的作品, 哪些是【用户真会看到】的。
#
# W2306 的教训必须用在这里: 一份字幕快照装着【全部语言】的条目, 只有一条是为这段音频
# 对齐的, 其余是从作品级抄来的副本。拿「每个条目 vs 它挂的音频」去判, 我上一轮
# 报了 4 条假越界、漏了 2 条真的。所以判链只有一条:
#
#   轨(lang,voice) → ♪N(问平台真源 loadWorkTakes 的产物) → 音频 URL →
#   该 ♪ 自己的 subtitle_url(空则回退作品级) → 按【轨的 lang】照引擎规则选条目 →
#   只在那个条目里找针
#
# 针 = 修前会被唱出来、修后不会的那些行(scripts/w2308-verify-multiline-bracket-fix.mjs 导出)。
# 只读, 不写, 不重做任何字幕。
import json, os, re, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh) cssos-audit"
API = "http://127.0.0.1:3000"
CDN = "https://cdn.cssstudio.app"
SEP = "\x1f"
NEEDLES = sys.argv[1] if len(sys.argv) > 1 else "/tmp/w2308-needles.json"
MINLEN = 12


def q(sql):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-X", "-q", "-t", "-A", "-F", SEP,
                        "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True, timeout=180)
    if r.returncode: print("QERR", r.stderr[:240]); sys.exit(2)
    return [ln.split(SEP) for ln in r.stdout.strip("\n").split("\n") if ln.strip()]


def get(u, timeout=90):
    try:
        rr = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=timeout)
        return rr.status, rr.read()
    except Exception as e:
        return (getattr(e, "code", None) or -1), b""


_sub = {}
def sub(url):
    """一份字幕 → {条目标签: [行文本]}。tokens 的字段名是 char(真源 app.emotion-subtitle-engine.js)。"""
    if url in _sub: return _sub[url]
    st, b = get(url)
    if st != 200: r = {"err": "HTTP %s" % st}
    else:
        try: j = json.loads(b)
        except Exception as e: j = None; r = {"err": "JSON %s" % e}
        if j is not None:
            r = {"entries": {}}
            for L in (j.get("languages") or []):
                tag = str(L.get("lang") or "")
                lines = []
                for s in (L.get("sections") or []):
                    for ln in (s.get("lines") or []):
                        tx = str(ln.get("text") or "") or "".join(
                            str(t.get("char") or "") for t in (ln.get("tokens") or []))
                        if tx.strip(): lines.append(tx)
                r["entries"][tag] = lines
    _sub[url] = r; return r


def pick_entry(entries, want):
    """照搬 app.emotion-subtitle-engine.js:141-160 的三段: 精确 → 同族 → 占位符兜底。
    (与 /tmp/w2306-judge.py 里那份逐字相同 —— 真源是那段 JS, 不是这里任何一份副本。)"""
    w = str(want or "")
    for tag in entries:
        if tag == w: return tag, "精确"
    norm = lambda s: (str(s).lower().split("-")[0] or str(s).lower())
    if w:
        for tag in entries:
            if norm(tag) == norm(w): return tag, "同族"
    PH = {"", "orig", "auto", "und"}
    if len(entries) == 1:
        only = list(entries)[0]
        if str(only).lower() in PH: return only, "占位符兜底"
    return None, "无"


sq = lambda s: re.sub(r"\s+", "", str(s or ""))

def match(needle, line):
    ns, t = sq(needle), sq(line)
    if not ns or not t: return False
    return t == ns or (len(ns) >= 16 and ns in t) or (len(t) >= 16 and t in ns)


NEED = {}
for w in json.load(open(NEEDLES, encoding="utf-8")):
    ns = [n for n in w.get("removed", []) if len(sq(n)) >= MINLEN]
    if ns: NEED[w["id"]] = (str(w.get("title") or ""), ns)

print("清单 %d 个作品(有够长的针)\n" % len(NEED))
live, inert, unknown = [], [], []

for wid, (title, needles) in sorted(NEED.items(), key=lambda x: x[1][0]):
    st, b = get("%s/api/works/%s/language-tracks" % (API, wid))
    if st != 200:
        print("[%s] %s —— ‼ 真源接口 HTTP %s, 判不了" % (wid[:8], title[:34], st))
        unknown.append((wid, "api", st)); continue
    tracks = json.loads(b).get("tracks") or []
    wl = "%s/works/%s/subtitle-take1.json" % (CDN, wid)
    rows, seen_sub = [], {}
    for t in tracks:
        lang = str(t.get("lang") or ""); voice = str(t.get("voice") or "auto")
        for tk in (t.get("takes") or []):
            n = tk.get("take"); su = str(tk.get("subtitle_url") or "").strip() or wl
            seen_sub.setdefault(su, set()).add(lang)
            info = sub(su)
            if info.get("err"):
                rows.append((lang, voice, n, su, "-", "字幕取不到 " + info["err"], 0))
                unknown.append((wid, "%s/%s♪%s" % (lang, voice, n), info["err"])); continue
            tag, how = pick_entry(info["entries"], lang)
            if tag is None:
                rows.append((lang, voice, n, su, "-", "没有能匹配的条目 → 这条轨哑", 0))
                unknown.append((wid, "%s/%s♪%s" % (lang, voice, n), "NO_ENTRY")); continue
            hit = [nd for nd in needles if any(match(nd, l) for l in info["entries"][tag])]
            rows.append((lang, voice, n, su, "%s·%s" % (tag, how), "命中 %d 条针" % len(hit) if hit else "干净", len(hit)))
            if hit: live.append(dict(wid=wid, title=title, lang=lang, voice=voice, take=n,
                                     sub=su, tag=tag, hits=hit))
    bad = sum(r[6] for r in rows)
    print("[%s] %s  针 %d · 轨×♪ %d → %s" % (wid[:8], title[:34], len(needles), len(rows),
          "‼ 可达命中" if bad else "可达范围内干净"))
    for lang, voice, n, su, tag, msg, h in rows:
        print("      %-18s ♪%-2s %-40s [%s] %s" % ("%s/%s" % (lang, voice), n,
              su.rsplit("/", 1)[-1][:40], tag, msg))
    # 同一批文件里【没有任何轨会读】的条目里的命中 —— 惰性, 不是用户问题
    for su, langs in seen_sub.items():
        info = sub(su)
        if info.get("err"): continue
        for tag, lines in info["entries"].items():
            if tag in langs: continue
            h = [nd for nd in needles if any(match(nd, l) for l in lines)]
            if h: inert.append(dict(wid=wid, title=title, sub=su, tag=tag, n=len(h)))

print("\n" + "=" * 100)
print("可达的泄漏(用户真会看到说明行): %d 处" % len(live))
for x in live:
    print("  ‼ %s %s  %s/%s ♪%s  [%s]  %d 条针" % (x["wid"][:8], x["title"][:30],
          x["lang"], x["voice"], x["take"], x["tag"], len(x["hits"])))
    for nd in x["hits"][:3]: print("        %s" % nd[:92])
print("\n惰性命中(命中的条目没有任何轨会读): %d 处" % len(inert))
for x in inert[:14]:
    print("  · %s %s  %s [%s] %d 条" % (x["wid"][:8], x["title"][:26], x["sub"].rsplit("/", 1)[-1][:34], x["tag"], x["n"]))
print("\n判不了: %d  %s" % (len(unknown), json.dumps(unknown[:8], ensure_ascii=False)))
wl_live = sorted({x["wid"] for x in live})
print("\n汇总: 清单 %d 作品 · 可达泄漏涉及 %d 个作品 · 惰性 %d 处 · 判不了 %d"
      % (len(NEED), len(wl_live), len(inert), len(unknown)))
print("可达泄漏的作品: %s" % ", ".join(w[:8] for w in wl_live))
print("VERDICT: W2308-reachable 结束(可达泄漏作品 %d / 判不了 %d)" % (len(wl_live), len(unknown)))
