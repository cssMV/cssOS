#!/usr/bin/env python3
"""W2277 —— 把 W2275 查出的「中文词配非中文文明」按【母语词是否已经写好】分两类。

Jing 2026-11-07:「同意，先5首跑通再放量。」放量前必须先知道这 170 首不是同一种毛病:

  A 类 —— 母语词【已经写好了, 只是从来没被唱过】。
          首例 Athena(0b897ef1): lyrics_preview 是完整 10 节古希腊语(带京典模版的
          `(Ἀρχαίη ὠδή)` 咒语行), 而三条 zh 轨各自挂着另一份 37 行的中文词。
          → 不该再找 LLM 写词。该走 W2130 的【原词直唱】(lyricsOverride),
            把现成的母语词唱出来。不花词的钱, 也没有 LLM 改写的风险。

  B 类 —— 词【本身就是中文写的】(中文正文 + 几行母语咒语)。
          首例 米开朗基罗诞辰(a52068d9) / Mandela(82a6f65c)。
          → 只能转译(transcreateLyrics), 由 `/api/works/:id/language-tracks` 走。

两类的做法、成本、风险都不同, 混在一起放量必然有一半做错。

判据两边【互相独立】(W2275 的教训 —— 两边同源 = 近乎同义反复, 必给漂亮的假通过):
  一边 = civ 推出的母语码, 抽 src/index.ts 的 CIV_LANGUAGE_ENTRIES 原文;
  另一边 = lyrics_preview 正文的字形, 用 audit-language-labels.py 的 detect_major 原文。
两份函数都【抽自活文件】, 不手抄 —— 抄一份就是造一份(W1960)。
"""
import os, sys, re, json, csv, io, subprocess, collections
csv.field_size_limit(10**7)
HERE = os.environ.get("CSSOS_SCRIPTS", os.path.dirname(os.path.abspath(__file__)))
TS   = os.environ.get("CSSOS_INDEX_TS", os.path.join(os.path.dirname(HERE), "src", "index.ts"))
DB   = os.environ.get("DATABASE_URL", "")

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
detect_major, fam = G["detect_major"], G["fam"]

blk = extract(TS, "const CIV_LANGUAGE_ENTRIES", "function civToLanguageServer", ["{ match:", "lang:"])
ENTRIES = []
for m in re.finditer(r"\{\s*match:\s*\[(.*?)\]\s*,\s*lang:\s*\"([a-z]{2,3})\"", blk, re.S):
    keys = re.findall(r'"([^"]+)"', m.group(1))
    if keys: ENTRIES.append((keys, m.group(2)))
if len(ENTRIES) < 25:
    sys.exit(f"FAIL: 只解出 {len(ENTRIES)} 条 civ 映射 —— 太少, 先去看 CIV_LANGUAGE_ENTRIES 的写法")

def civ_lang(civ):
    s = (civ or "").strip().lower()
    if not s: return ""
    for keys, lang in ENTRIES:
        for k in keys:
            if k.lower() in s: return lang
    return ""

# 校准: 先在已知答案上过一遍, 过不了就别信后面的结论(audit-must-report-its-own-gaps)
for c, want in [("古希腊神话", "el"), ("古罗马文明", "la"), ("日本古典", "ja"),
                ("文艺复兴欧洲", "it"), ("现代非洲", "sw"), ("中华文明", "zh"),
                ("阿契美尼德波斯", "peo"), ("波斯文明", "fa"), ("", "")]:
    got = civ_lang(c)
    if got != want:
        sys.exit(f"FAIL 校准: civ_lang({c!r}) = {got!r}, 应为 {want!r}")
print(f"civ→母语 {len(ENTRIES)} 条, 校准通过")

ids = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()] if len(sys.argv) > 1 else []
if not ids: sys.exit("用法: w2277-classify-civ-mismatch.py <每行一个 work_id 的文件>")
inlist = ",".join("'" + i.replace("'", "") + "'" for i in ids)
q = f"""COPY (SELECT w.id, coalesce(w.civilization,''), coalesce(w.title,''),
        coalesce(w.lyrics_preview,''), w.status, coalesce(w.duration_secs,0),
        (SELECT count(*) FROM work_language_tracks t WHERE t.work_id=w.id),
        (SELECT count(*) FROM work_language_tracks t
          WHERE t.work_id=w.id AND t.is_default AND t.status='ready' AND t.audio_url IS NOT NULL)
      FROM user_works w WHERE w.id IN ({inlist})) TO STDOUT WITH (FORMAT csv)"""
raw = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
rows = [r for r in csv.reader(io.StringIO(raw.stdout)) if len(r) >= 8]
if len(rows) != len(ids):
    print(f"⚠ 清单 {len(ids)} 个, 实际查到 {len(rows)} 个 —— 差 {len(ids)-len(rows)} 个")

out, cnt = [], collections.Counter()
for wid, civ, title, lyr, st, dur, ntr, cover in rows:
    body = re.sub(r"^\s*\(.*?\)\s*", "", lyr, flags=re.M)   # 去掉 (咒语) 前缀, 它本来就是母语
    top, nlines, dist = detect_major(body)
    mother = civ_lang(civ)
    if nlines < 6:
        cls = "C 证据不足"
    elif top and mother and fam(top) == fam(mother):
        cls = "A 母语词已写好"
    else:
        cls = "B 词是中文写的"
    cnt[cls] += 1
    cnt[(cls, mother)] += 1
    out.append(dict(work=wid, title=title, civ=civ, mother=mother, status=st,
                    dur=int(dur), tracks=int(ntr), cover_ok=int(cover),
                    prev_lang=top, prev_lines=nlines, dist=dist, cls=cls))

print(f"\n清单 {len(ids)} 个, 判过 {len(rows)} 个")
for k in ("A 母语词已写好", "B 词是中文写的", "C 证据不足"):
    print(f"  {k}: {cnt[k]}")
print("\n按母语分:")
for (cls, mother), n in sorted(((k, v) for k, v in cnt.items() if isinstance(k, tuple)),
                               key=lambda kv: (kv[0][0], -kv[1])):
    print(f"  {cls}  {mother or '(无)'}: {n}")
dst = os.environ.get("OUT", "/tmp/w2277-classes.json")
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\n→ {dst}")
