#!/usr/bin/env python3
"""W2274 — 给 16 处 LANG_MISSING 取证: 文件里那几条到底是什么语言, 轨声称的是什么。

判据【不另造】: 语言判定 exec 出 audit-language-labels.py 里 detect_major/fam 的原文;
字幕地址解析 exec 出 audit-take-subtitles.py 里 get/sub_url/lines_of 的原文。
抄一份就是造一份(W1960)。

在 api-vm 上跑: set -a; . /etc/cssos.env; set +a; python3 -I w2274-evidence.py <audit.json>
"""
import os, sys, json, re, collections, urllib.request, subprocess, csv, io

HERE = os.path.dirname(os.path.abspath(__file__))

def extract(path, start, stop, needs):
    src = open(path, encoding="utf-8").read()
    a = src.index(start)
    b = src.index(stop, a)
    blk = src[a:b]
    for n in needs:
        if n not in blk:
            sys.exit(f"FAIL: 没能从 {path} 抽出 {n!r} —— 文件结构变了, 先去看它")
    return blk

# ① 语言判定(逐行取多数, 跳过 [tag] 行与过短行)
L = extract(os.path.join(HERE, "audit-language-labels.py"),
            "def detect(t):", 'q="""COPY', ["def detect(t):", "def detect_major(t):", "FAM=", "fam="])
ns1 = {"collections": collections, "re": re}
exec(L, ns1)
detect_major, fam = ns1["detect_major"], ns1["fam"]

# ② 字幕地址解析(照搬 app.takes.js 的 takeSubtitleUrl, 含 pre-epic 短路)
T = extract(os.path.join(HERE, "audit-take-subtitles.py"),
            "_cache = {}", "def ends(entry):",
            ["def get(u)", "def sub_url(tr, take)", "def lines_of(entry)"])
ns2 = {"os": os, "json": json, "urllib": urllib,
       "API": "https://cssstudio.app", "UA": {"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"}}
exec(T, ns2)
get, sub_url, lines_of = ns2["get"], ns2["sub_url"], ns2["lines_of"]

AUDIT = sys.argv[1]
fs = [f for f in json.load(open(AUDIT))["findings"] if f.get("kind") == "LANG_MISSING"]
print(f"LANG_MISSING {len(fs)} 条", file=sys.stderr)

# ③ 库里这些作品的歌词与轨
wids = sorted({f["work"] for f in fs})
DB = os.environ["DATABASE_URL"]
q = ("COPY (select w.id, coalesce(w.title,''), coalesce(w.language,''), coalesce(w.civilization,''), "
     "coalesce(w.lyrics_preview,'') from user_works w where w.id in (%s)) TO STDOUT WITH (FORMAT csv)"
     % ",".join("'%s'::uuid" % i for i in wids))
out = subprocess.run(["psql", DB, "-X", "-q", "-c", q], capture_output=True, text=True)
WORK = {r[0]: dict(title=r[1], language=r[2], civ=r[3], lyrics=r[4])
        for r in csv.reader(io.StringIO(out.stdout)) if len(r) >= 5}
q2 = ("COPY (select t.work_id, coalesce(t.lang,''), coalesce(t.voice,'auto'), coalesce(t.lyrics,'') "
      "from work_language_tracks t where t.work_id in (%s)) TO STDOUT WITH (FORMAT csv)"
      % ",".join("'%s'::uuid" % i for i in wids))
out2 = subprocess.run(["psql", DB, "-X", "-q", "-c", q2], capture_output=True, text=True)
TRK = {}
for r in csv.reader(io.StringIO(out2.stdout)):
    if len(r) >= 4: TRK[(r[0], r[1], r[2])] = r[3]

def body(entry):
    return "\n".join(x for x, _, _ in lines_of(entry) if x and x != "[Music...]")

rows = []
for f in fs:
    wid = f["work"]; who = f["track"]; tk = int(str(f["take"]).replace("♪", ""))
    lang, voice = who.split("/", 1)
    d = get(f"https://cssstudio.app/api/works/{wid}/language-tracks")
    tr = next((t for t in (d.get("tracks") or []) if (t.get("lang") or "") == lang
               and (t.get("voice") or "auto") == voice), None)
    if tr is None:
        rows.append(dict(work=wid, who=who, take=tk, err="API 里找不到这条轨")); continue
    u, via = sub_url(tr, tk)
    doc = get(u) if u else {"__err": "no url"}
    ents = []
    for e in (doc.get("languages") or []):
        b = body(e)
        top, tot, dist = detect_major(b)
        ents.append(dict(tag=e.get("lang"), nlines=len(b.split("\n")) if b else 0,
                         script=top, judged=tot, dist=dist, fam=fam(top),
                         sample=b[:48].replace("\n", " / ")))
    tl = TRK.get((wid, lang, voice), "")
    wl = WORK.get(wid, {})
    rows.append(dict(work=wid, title=wl.get("title", ""), who=who, take=tk, url=u, via=via,
                     work_language=wl.get("language", ""), civ=wl.get("civ", ""),
                     track_lyrics_script=(detect_major(tl)[0] if tl.strip() else None),
                     track_lyrics_dist=(detect_major(tl)[2] if tl.strip() else None),
                     work_lyrics_script=(detect_major(wl.get("lyrics", ""))[0] if (wl.get("lyrics") or "").strip() else None),
                     work_lyrics_dist=(detect_major(wl.get("lyrics", ""))[2] if (wl.get("lyrics") or "").strip() else None),
                     entries=ents, err=doc.get("__err")))
json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
