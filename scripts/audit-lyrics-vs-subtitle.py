#!/usr/bin/env python3
"""巡检 — 【这条轨唱的词】和【播放端显示的字幕正文】是不是同一种语言。(W2275, 2026-11-06)

Jing 2026-11-06:「什么语言的音乐, 就应该是什么语言的情绪字幕。」

⚠ 判据走到第三版才对, 前两版都是【比错了东西】, 留档:
  第一版 文件里的 languages[].lang  vs 它自己的正文 —— 标签是 alignLang 从正文推出来的,
         两边同源, 按定义几乎必然一致 → 只报 48 处, 没一处是 Jing 说的形状。近乎同义反复。
  第二版 轨声明的 lang            vs 正文        —— 标签本身可能就是错的(全库 17 处),
         而【标签和正文一起错成中文】时两边一致 → 照样看不见。
  第三版(本份) 轨实际唱的【歌词】   vs 正文        —— 歌词是音频的来源(Suno 拿它唱),
         与字幕是两个独立来源。这才是 Jing 那句话字面的意思。

歌词来源照搬 src/index.ts resubtitle 的兜底链: 轨.lyrics → 作品 lyrics_preview。
字幕解析链照搬 public/app.takes.js takeSubtitleUrl()。判据 exec 既有审计脚本的原文。
"""
import os, sys, json, csv, io, subprocess, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
csv.field_size_limit(10**7)
HERE = os.environ.get("CSSOS_SCRIPTS", "/Users/cssos/cssOS/scripts")

def extract(path, start, stop, needs):
    src = open(path, encoding="utf-8").read()
    a = src.index(start); b = src.index(stop, a); blk = src[a:b]
    for n in needs:
        if n not in blk: sys.exit(f"FAIL: 没能从 {path} 抽出 {n!r} —— 文件结构变了, 先去看它")
    return blk

G = {}
exec("import collections\n" + extract(os.path.join(HERE, "audit-language-labels.py"),
        "def detect(t):", 'q="""COPY', ["def detect(t):", "def detect_major(t):", "FAM=", "fam="]), G)
detect_major, fam = G["detect_major"], G["fam"]
G2 = {}
exec("import sys, os, json, urllib.request, collections\n_cache={}\n" + extract(
        os.path.join(HERE, "audit-take-subtitles.py"), "UA   = {", "# ── 时间轴判据",
        ["def get(u)", "def sub_url(tr, take)"]).replace("UA   = {", "UA = {"), G2)
get, sub_url = G2["get"], G2["sub_url"]

PH = {"", "orig", "auto", "und", "orig-pre-epic"}
def body_of(e):
    out = []
    for sec in (e.get("sections") or []):
        for ln in (sec.get("lines") or []):
            t = (ln.get("text") or "").strip()
            if t and t not in ("[Music...]", "～"): out.append(t)
    return "\n".join(out)

def pick_entry(doc, lang):
    """W1961 严格 + W1965 占位符兜底 —— 兜底那一支【照搬引擎原文的判据】:
    只在「全文件仅一条 + 标签是占位符 + 正文字形与请求语言实测一致」时放行。"""
    langs = doc.get("languages") or []
    l = (lang or "").lower()
    for e in langs:
        if str(e.get("lang") or "").lower() == l: return e, "严格"
    for e in langs:
        if str(e.get("lang") or "").lower().split("-")[0] == l.split("-")[0]: return e, "归一"
    if len(langs) == 1 and str(langs[0].get("lang") or "").lower() in ("", "orig", "auto", "und"):
        txt = body_of(langs[0])[:600]
        import re
        script = ("ko" if re.search(r"[가-힯]", txt) else
                  "ja" if re.search(r"[぀-ヿ]", txt) else
                  "zh" if re.search(r"[一-鿿]", txt) else
                  "latin" if re.search(r"[A-Za-z]", txt) else "")
        want = l.split("-")[0]
        if script == want or (script == "latin" and want and want not in ("zh", "ja", "ko")):
            return langs[0], "W1965兜底"
    return None, "取不到"

DB = os.environ.get("DATABASE_URL")
if not DB: sys.exit("没有 DATABASE_URL —— 这份要在 api-vm 上跑")
q = """COPY (
  select t.work_id::text, coalesce(t.lang,''), coalesce(t.voice,'auto'),
         coalesce(w.title,''), coalesce(w.language,''), coalesce(w.civilization,''),
         case when coalesce(t.lyrics,'') <> '' then 'own' else 'work-preview' end,
         case when coalesce(t.lyrics,'') <> '' then t.lyrics else coalesce(w.lyrics_preview,'') end
    from work_language_tracks t join user_works w on w.id=t.work_id
   where coalesce(t.audio_url,'') <> ''
   order by t.work_id, t.lang) TO STDOUT WITH (FORMAT csv)"""
out = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
if out.returncode: sys.exit("psql 失败: " + out.stderr[:400])
rows = [r for r in csv.reader(io.StringIO(out.stdout)) if len(r) >= 8]
byw = collections.defaultdict(dict)
meta = {}
for wid, lang, voice, title, wlang, civ, src, lyr in rows:
    byw[wid][(lang, voice)] = (src, lyr)
    meta[wid] = (title, wlang, civ)
print(f"清单 {len(byw)} 个有语言轨的作品 / {len(rows)} 条轨")

API = "https://cssstudio.app"
findings, stat = [], collections.Counter()
judged = 0
def do(wid):
    d = get(f"{API}/api/works/{wid}/language-tracks")
    title, wlang, civ = meta[wid]
    if "__err" in d: return [("FETCH_FAIL", wid, title, "-", "-", "", d["__err"])], 0
    rs = []
    for tr in (d.get("tracks") or d.get("language_tracks") or []):
        lang, voice = str(tr.get("lang") or ""), str(tr.get("voice") or "auto")
        who = f"{lang}/{voice}"
        ent = byw[wid].get((lang, voice)) or byw[wid].get((lang, "auto"))
        if not ent: stat["接口有这条轨但库里没对上(伪轨/声线名不同)"] += 1; continue
        src, lyr = ent
        ltop, ln_, ldist = detect_major(lyr or "")
        if not ltop or ln_ < 6: stat[f"歌词证据不足(<6 行) src={src}"] += 1; continue
        n_takes = max(1, len(tr.get("takes") or []))
        for i in range(1, n_takes + 1):
            u, via = sub_url(tr, i)
            if not u: stat["这一版没字幕"] += 1; continue
            if u.startswith("/"): u = API + u
            doc = get(u)
            if "__err" in doc:
                rs.append(("FETCH_FAIL", wid, title, who, f"♪{i}", "", doc["__err"])); continue
            e, how = pick_entry(doc, lang)
            if e is None: stat["文件里没有这条轨的语言(另有宪法)"] += 1; continue
            btop, bn, bdist = detect_major(body_of(e))
            if not btop or bn < 6: stat["字幕证据不足(<6 行)"] += 1; continue
            if fam(ltop) == fam(btop): stat["对的"] += 1; continue
            rs.append(("LYRICS_VS_SUBTITLE", wid, title, who, f"♪{i}",
                       f"{ltop}->{btop}",
                       f"{how} 歌词({src},{ln_}行){ldist} 字幕({bn}行){bdist} civ={civ} wlang={wlang}"))
    return rs, 1

with ThreadPoolExecutor(max_workers=16) as ex:
    for rs, j in ex.map(do, list(byw.keys())):
        findings += rs; judged += j

print(f"判过 {judged}/{len(byw)} 个作品")
for k, v in stat.most_common(): print(f"  {k}: {v}")
bad = [f for f in findings if f[0] == "LYRICS_VS_SUBTITLE"]
print(f"\n唱的词 ≠ 显示的字幕: {len(bad)} 处")
for (p,), n in collections.Counter((f[5],) for f in bad).most_common():
    print(f"  词{p.split('->')[0]:4s} → 字幕{p.split('->')[1]:4s} : {n}")
print()
for f in sorted(bad, key=lambda x: (x[5], x[1])):
    print(f"  {f[1][:8]} {f[3]:18s} {f[4]:4s} {f[5]:10s} {f[2][:36]}\n        {f[6]}")
ff = [f for f in findings if f[0] == "FETCH_FAIL"]
if ff:
    print(f"\n取不到 {len(ff)} 处(这【不是】『对』):")
    for f in ff[:15]: print("  ", f[1][:8], f[3], f[6])
json.dump([dict(kind=f[0], work=f[1], title=f[2], who=f[3], take=f[4], pair=f[5], note=f[6])
           for f in findings], open("/tmp/w2275-lyr-vs-sub.json", "w"), ensure_ascii=False, indent=1)
print("\n→ /tmp/w2275-lyr-vs-sub.json")
