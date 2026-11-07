#!/usr/bin/env python3
"""巡检 — 作品的【文明】要求什么母语, 它的字幕正文却是什么语言。(W2275, 2026-11-06)

Jing 2026-11-06:「什么语言的音乐, 就应该是什么语言的情绪字幕。」

这一判据是【文明智能联动】那一侧: 人物/文明定下母语(civToLanguageServer),
点人物卡进 MV 的那条路【必须】按母语出词出字幕, 与 UI 语言、与用户选的语言都无关。
于是「古希腊神话的作品字幕是中文」就是违宪, 而前面三份按标签/按歌词比的巡检都看不见它 ——
因为那些作品的【词本身】也已经被写成中文了, 标签、词、字幕三者自洽, 错的是它们共同偏离了文明。

civ→母语的映射【不自己编】: 直接从 src/index.ts 抽 CIV_LANGUAGE_ENTRIES 的原文,
抽不到就退出(别让一份手抄的映射表悄悄和平台漂移)。
"""
import os, sys, re, json, csv, io, subprocess, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
csv.field_size_limit(10**7)
HERE = os.environ.get("CSSOS_SCRIPTS", "/Users/cssos/cssOS/scripts")
TS   = os.environ.get("CSSOS_INDEX_TS", "/Users/cssos/cssOS/src/index.ts")

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

# ── civ → 母语: 抽 CIV_LANGUAGE_ENTRIES 原文 ────────────────────────────────
blk = extract(TS, "const CIV_LANGUAGE_ENTRIES", "function civToLanguageServer",
              ["{ match:", "lang:"])
ENTRIES = []
for m in re.finditer(r"\{\s*match:\s*\[(.*?)\]\s*,\s*lang:\s*\"([a-z]{2,3})\"", blk, re.S):
    keys = re.findall(r'"([^"]+)"', m.group(1))
    if keys: ENTRIES.append((keys, m.group(2)))
if len(ENTRIES) < 25:
    sys.exit(f"FAIL: 只解出 {len(ENTRIES)} 条 civ 映射 —— 太少, 先去看 CIV_LANGUAGE_ENTRIES 的写法")
print(f"civ→母语映射解出 {len(ENTRIES)} 条(顺序即优先级, 与 civToLanguageServer 一致)")
def civ_lang(civ):
    s = (civ or "").strip().lower()
    if not s: return ""
    for keys, lang in ENTRIES:
        for k in keys:
            if k.lower() in s: return lang
    return ""
# ── 自检: 先在已知答案上校准映射, 再去判全库(「校验器必须报自己的漏」) ──────────
def _self_test():
    cases = [("古希腊神话", "el"), ("古罗马文明", "la"), ("日本古典", "ja"),
             ("文艺复兴欧洲", "it"), ("中华文明", "zh"), ("现代非洲", "sw"),
             ("莫卧儿印度", "ur"), ("阿契美尼德波斯", "peo"), ("波斯文明", "fa"),
             ("", "")]
    bad = 0
    for civ, want in cases:
        got = civ_lang(civ)
        ok = got == want
        if not ok: bad += 1
        print(f"  {'✓' if ok else '✗'} civ_lang({civ!r}) = {got!r}" + ("" if ok else f" , 期望 {want!r}"))
    # 顺序即优先级: 阿契美尼德必须先于通用「波斯」命中, 否则这一条自检会失败
    return bad
if "--self-test" in sys.argv:
    sys.exit(1 if _self_test() else 0)
if _self_test():
    sys.exit("映射自检没过 —— 不拿一份坏映射去判全库")

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            return json.loads(r.read())
    except Exception as e: return {"__err": str(e)[:120]}
def body_of(e):
    return "\n".join(t for s in (e.get("sections") or []) for ln in (s.get("lines") or [])
                     for t in [(ln.get("text") or "").strip()] if t and t not in ("[Music...]", "～"))

DB = os.environ.get("DATABASE_URL")
if not DB: sys.exit("没有 DATABASE_URL")
q = """COPY (
  select w.id::text, coalesce(w.title,''), coalesce(w.civilization,''), coalesce(w.language,''),
         w.subtitle_take1_json_url, coalesce(w.status,''),
         (select count(*) from work_language_tracks t where t.work_id=w.id)::text,
         coalesce((select string_agg(distinct coalesce(t.lang,''), '/') from work_language_tracks t
                    where t.work_id=w.id), '')
    from user_works w
   where coalesce(w.civilization,'') <> '' and coalesce(w.subtitle_take1_json_url,'') <> ''
   order by w.created_at desc) TO STDOUT WITH (FORMAT csv)"""
out = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
if out.returncode: sys.exit("psql 失败: " + out.stderr[:400])
rows = [r for r in csv.reader(io.StringIO(out.stdout)) if len(r) >= 8]
print(f"清单 {len(rows)} 个【有 civilization 且有字幕】的作品")

findings, stat = [], collections.Counter()
def do(r):
    wid, title, civ, wlang, suburl, status, ntr, tlangs = r[:8]
    ml = civ_lang(civ)
    if not ml: return [], "civ 认不出母语"
    u = suburl if not suburl.startswith("/") else "https://cssstudio.app" + suburl
    doc = get(u)
    if "__err" in doc: return [("FETCH_FAIL", wid, title, civ, ml, "", doc["__err"])], None
    langs = doc.get("languages") or []
    tops = []
    for e in langs:
        t, n, d = detect_major(body_of(e))
        if t and n >= 6: tops.append((str(e.get("lang")), t, n))
    if not tops: return [], "字幕证据不足"
    # 母语那一份在不在? 只要【任何一条】字幕正文是母语文字, 就算联动没断。
    if any(fam(t) == fam(ml) for _, t, _ in tops): return [], "对的(有母语字幕)"
    return [("CIV_MISMATCH", wid, title, civ, ml,
             "/".join(f"{tag}:{t}({n}行)" for tag, t, n in tops),
             f"轨{ntr}[{tlangs}] wlang={wlang} status={status}")], None

with ThreadPoolExecutor(max_workers=16) as ex:
    for rs, note in ex.map(do, rows):
        findings += rs
        if note: stat[note] += 1
for k, v in stat.most_common(): print(f"  {k}: {v}")
bad = [f for f in findings if f[0] == "CIV_MISMATCH"]
print(f"\n文明要求的母语, 字幕里一条都没有: {len(bad)} 个作品")
cnt = collections.Counter((f[4], f[5].split(":")[1].split("(")[0]) for f in bad)
for (ml, got), n in cnt.most_common(): print(f"   母语应为 {ml:4s} 字幕却是 {got:4s} : {n}")
print()
for f in sorted(bad, key=lambda x: (x[4], x[1])):
    print(f"  {f[1][:8]} 母语{f[4]:4s} 字幕[{f[5]}] civ={f[3][:14]:14s} {f[2][:34]}  ({f[6]})")
ff = [f for f in findings if f[0] == "FETCH_FAIL"]
if ff: print(f"\n取不到 {len(ff)} 个(这【不是】『对』)")
json.dump([dict(kind=f[0], work=f[1], title=f[2], civ=f[3], mother=f[4], subs=f[5], note=f[6])
           for f in findings], open("/tmp/w2275-civ.json", "w"), ensure_ascii=False, indent=1)
print("\n→ /tmp/w2275-civ.json")
