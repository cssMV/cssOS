#!/usr/bin/env python3
"""巡检 — 每条轨【播放端真正会显示的那份正文】是什么语言, 和这条轨的语言一致吗。
(W2275, 2026-11-06)

Jing:「什么语言的音乐, 就应该是什么语言的情绪字幕。」

⚠ 第一版判据是【错的】, 留档警示: 我拿「文件里的 languages[].lang 标签」去比「它自己的正文」。
   那个标签本来就是 alignLang 写进去的, 而 alignLang 又是从正文字形推出来的 ——
   两边同源, 按定义几乎必然一致, 所以只报出 48 处, 且一处都不是 Jing 说的那个形状。
   【近乎同义反复的判据会给出一份漂亮的假通过。】
正确的比较对象是【轨自己声明的语言】(以及作品行/文明), 它与正文是两个独立来源。

解析链照搬 public/app.takes.js takeSubtitleUrl()(exec audit-take-subtitles.py 的原文)。
"""
import os, sys, json, csv, io, subprocess, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor

HERE = os.environ.get("CSSOS_SCRIPTS", "/Users/cssos/cssOS/scripts")

def extract(path, start, stop, needs):
    src = open(path, encoding="utf-8").read()
    a = src.index(start); b = src.index(stop, a); blk = src[a:b]
    for n in needs:
        if n not in blk:
            sys.exit(f"FAIL: 没能从 {path} 抽出 {n!r} —— 文件结构变了, 先去看它")
    return blk

G = {}
exec("import collections\n" + extract(os.path.join(HERE, "audit-language-labels.py"),
        "def detect(t):", 'q="""COPY', ["def detect(t):", "def detect_major(t):", "FAM=", "fam="]), G)
detect, detect_major, fam = G["detect"], G["detect_major"], G["fam"]

G2 = {"json": json, "urllib": urllib, "collections": collections}
exec("import sys, os, json, urllib.request, collections\n_cache={}\n" + extract(
        os.path.join(HERE, "audit-take-subtitles.py"), "UA   = {", "# ── 时间轴判据",
        ["def get(u)", "def sub_url(tr, take)"]).replace("UA   = {", "UA = {"), G2)
get, sub_url = G2["get"], G2["sub_url"]

def body_of(entry):
    out = []
    for sec in (entry.get("sections") or []):
        for ln in (sec.get("lines") or []):
            t = (ln.get("text") or "").strip()
            if t and t not in ("[Music...]", "～"): out.append(t)
    return "\n".join(out)

PH = {"", "orig", "auto", "und", "orig-pre-epic"}
def pick_entry(doc, lang):
    """照 W1961 严格匹配 + W1965 占位符兜底的精神挑出播放端会用的那一条。"""
    langs = doc.get("languages") or []
    l = (lang or "").lower()
    for e in langs:
        if str(e.get("lang") or "").lower() == l: return e, "严格"
    for e in langs:
        if str(e.get("lang") or "").lower().split("-")[0] == l.split("-")[0]: return e, "归一"
    if len(langs) == 1 and str(langs[0].get("lang") or "").lower() in PH:
        return langs[0], "W1965兜底"
    return None, "取不到"

DB = os.environ.get("DATABASE_URL")
if not DB: sys.exit("没有 DATABASE_URL —— 这份要在 api-vm 上跑")
q = """COPY (
  select w.id, coalesce(w.title,''), coalesce(w.language,''), coalesce(w.civilization,'')
    from user_works w
   where exists (select 1 from work_language_tracks t where t.work_id=w.id)
      or coalesce(w.preview_audio_url,'') <> ''
   order by w.created_at desc) TO STDOUT WITH (FORMAT csv)"""
out = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
if out.returncode: sys.exit("psql 失败: " + out.stderr[:400])
ids = [r for r in csv.reader(io.StringIO(out.stdout)) if len(r) >= 4]
LIMIT = int(next((a.split("=",1)[1] for a in sys.argv if a.startswith("--limit=")), "0") or 0)
if LIMIT: ids = ids[:LIMIT]
API = "https://cssstudio.app"
print(f"清单 {len(ids)} 个作品")

findings, stat = [], collections.Counter()
judged = 0
def do(row):
    wid, title, wlang, civ = row[0], row[1], row[2], row[3]
    d = get(f"{API}/api/works/{wid}/language-tracks")
    if "__err" in d: return [("FETCH_FAIL", wid, title, "-", "", "", d["__err"])], 0
    rs = []
    for tr in (d.get("tracks") or d.get("language_tracks") or []):
        lang, voice = str(tr.get("lang") or ""), str(tr.get("voice") or "auto")
        who = f"{lang}/{voice}"
        n_takes = max(1, len(tr.get("takes") or []))
        for i in range(1, n_takes + 1):
            u, via = sub_url(tr, i)
            if not u: stat["无字幕"] += 1; continue
            if u.startswith("/"): u = API + u
            doc = get(u)
            if "__err" in doc:
                rs.append(("FETCH_FAIL", wid, title, who, f"♪{i}", "", doc["__err"])); continue
            e, how = pick_entry(doc, lang)
            if e is None: stat["文件里没有这条轨的语言(另有宪法)"] += 1; continue
            top, n, dist = detect_major(body_of(e))
            if not top or n < 6: stat["证据不足(<6 行)"] += 1; continue
            # 轨的 lang 是占位符 → 没有可比的声明, 退一步比【作品行】
            decl = lang if (lang or "").lower() not in PH else wlang
            if (decl or "").lower() in PH or not decl:
                stat["轨与作品行都没有声明语言"] += 1; continue
            if fam(decl) == fam(top): stat["对的"] += 1; continue
            rs.append(("TRACK_BODY_MISMATCH", wid, title, who, f"♪{i}",
                       f"{decl}->{top}", f"{how} 判了{n}行 {dist} civ={civ}"))
    return rs, 1

with ThreadPoolExecutor(max_workers=16) as ex:
    for rs, j in ex.map(do, ids):
        findings += rs; judged += j

print(f"判过 {judged}/{len(ids)} 个作品")
for k, v in stat.most_common(): print(f"  {k}: {v}")
bad = [f for f in findings if f[0] == "TRACK_BODY_MISMATCH"]
print(f"\n轨声明的语言 ≠ 实际显示的正文: {len(bad)} 处")
for (p,), n in collections.Counter((f[5],) for f in bad).most_common():
    print(f"  {p} : {n}")
print()
for f in sorted(bad, key=lambda x: x[5]):
    print(f"  {f[1][:8]} {f[3]:20s} {f[4]:4s} {f[5]:12s} {f[2][:34]}  ({f[6]})")
ff = [f for f in findings if f[0] == "FETCH_FAIL"]
if ff:
    print(f"\n取不到 {len(ff)} 处(这【不是】『对』):")
    for f in ff[:15]: print("  ", f[1][:8], f[3], f[6])
json.dump([dict(kind=f[0], work=f[1], title=f[2], who=f[3], take=f[4], pair=f[5], note=f[6])
           for f in findings], open("/tmp/w2275-track-findings.json", "w"), ensure_ascii=False, indent=1)
print("\n→ /tmp/w2275-track-findings.json")
