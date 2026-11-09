#!/usr/bin/env python3
"""逐首核对一个手写词批次的结果。清单驱动, 不是「库里查到什么就报什么」。

判据(每一条都必须自己过, 任一不过这首就是 FAIL):
  1 库里确实多了一条 (work_id, lang, voice) 的轨, status=ready
  2 轨里的 lyrics 与【我发出去的那个文件】逐字节相同(先比原文, 再比逐行 strip 后)
  3 ♪1 audio_url 与 ♪2 alt_audio_url 都在, 且 host 是我们自己的域
  4 两颗 ♪ 的时长都实测到了(非 NULL) —— 空时长会让巡检静默漏判
  5 subtitle_url 在

⚠ 汇总必须打印【清单 N / 实际 M】并在不等时尖叫 —— 不许只报查到的那些。
用法: python3 -I w2279-verify-batch.py <manifest.tsv> <lyrics_dir>
"""
import os, sys, subprocess, hashlib, json
from urllib.parse import urlparse

if len(sys.argv) < 3: sys.exit("用法: w2279-verify-batch.py <manifest.tsv> <lyrics_dir>")
MAN, LYRDIR = sys.argv[1], sys.argv[2]

OURS = {"cssstudio.app", "www.cssstudio.app", "cdn.cssstudio.app", "media.cssstudio.app"}

def dburl():
    env = os.environ.get("DATABASE_URL")
    if env: return env
    for ln in open("/etc/cssos.env"):
        ln = ln.strip()
        if ln.startswith("DATABASE_URL="):
            return ln.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("FAIL: 找不到 DATABASE_URL —— 别继续, 否则下面每条结论都是空的")
DB = dburl()

plan = []
for ln in open(MAN):
    ln = ln.rstrip("\n")
    if not ln.strip() or ln.lstrip().startswith("#"): continue
    p = ln.split("\t")
    if len(p) < 3: continue
    plan.append((p[0].strip(), p[1].strip(), p[2].strip()))
if not plan: sys.exit(f"FAIL: 清单 {MAN} 一行都没读到")
print(f"清单 {len(plan)} 首\n")

def norm_lines(s):
    return "\n".join(x.rstrip() for x in s.replace("\r\n", "\n").split("\n")).strip()

ok, bad = [], []
for wid, lang, lyrfile in plan:
    # 清单第三列可能是文件名, 也可能已经是绝对路径(dogwalker-pairs.tsv 就是后者)
    path = lyrfile if os.path.isabs(lyrfile) else os.path.join(LYRDIR, lyrfile)
    if not os.path.exists(path):
        bad.append((wid[:8], lyrfile, ["发出去的词文件现在找不到了, 无法比对 —— 判不了就是不过"])); continue
    sent = open(path, encoding="utf-8").read()

    sql = ("\\pset pager off\n\\pset format unaligned\n\\pset tuples_only on\n"
           "SELECT json_agg(row_to_json(t))::text FROM (SELECT id, lang, voice, status, "
           "coalesce(audio_url,'') a1, coalesce(alt_audio_url,'') a2, duration_secs d1, "
           "alt_duration_secs d2, coalesce(subtitle_url,'') sub, "
           "replace(coalesce(lyrics,''),chr(10),'~NL~') lyr, "
           "to_char(created_at,'MM-DD HH24:MI') cre "
           f"FROM work_language_tracks WHERE work_id='{wid}' ORDER BY id) t;\n")
    r = subprocess.run(["psql", DB, "-X", "-q"], input=sql, capture_output=True, text=True)
    if r.returncode: bad.append((wid[:8], lyrfile, ["psql 失败: " + r.stderr[:160]])); continue
    try: rowsall = json.loads(r.stdout.strip() or "null") or []
    except Exception as e: bad.append((wid[:8], lyrfile, [f"轨 JSON 解析失败: {e}"])); continue

    # 认哪一条: lang 对上, 且 lyrics 与发出去的那份匹配 —— 不靠「最新一条」, 那会认错
    cand = [t for t in rowsall if t["lang"] == lang]
    match = [t for t in cand if norm_lines((t["lyr"] or "").replace("~NL~", "\n")) == norm_lines(sent)]
    why = []
    if not cand:
        bad.append((wid[:8], lyrfile, [f"库里没有 lang={lang} 的轨 —— 这首根本没落地"])); continue
    if not match:
        got = [norm_lines((t["lyr"] or "").replace("~NL~", "\n")) for t in cand]
        why.append(f"lang={lang} 有 {len(cand)} 条轨, 但没有一条的词与我发出去的那份相同 "
                   f"(发出 {len(norm_lines(sent).splitlines())} 行/sha {hashlib.sha1(norm_lines(sent).encode()).hexdigest()[:10]}; "
                   f"库里 {[str(len(g.splitlines()))+'行/'+hashlib.sha1(g.encode()).hexdigest()[:10] for g in got]})")
        bad.append((wid[:8], lyrfile, why)); continue
    t = match[-1]
    exact = (t["lyr"] or "").replace("~NL~", "\n") == sent

    if t["status"] != "ready": why.append(f"status={t['status']} 不是 ready")
    for tag, u in (("♪1", t["a1"]), ("♪2", t["a2"])):
        if not u: why.append(f"{tag} 没有 audio_url")
        else:
            h = (urlparse(u).hostname or "").lower()
            if h not in OURS: why.append(f"{tag} 的 host 是 {h} —— 不是我们的域, 会过期")
    if t["d1"] is None: why.append("♪1 duration_secs 是 NULL —— 巡检会静默漏判")
    if t["d2"] is None: why.append("♪2 alt_duration_secs 是 NULL")
    if not t["sub"]: why.append("subtitle_url 空 —— 这一版没有自己的字幕")

    if why: bad.append((wid[:8], lyrfile, why))
    else: ok.append((wid[:8], lang, t["voice"], t["d1"], t["d2"], "逐字节相同" if exact else "逐行 strip 后相同", lyrfile))

for s, lang, voice, d1, d2, how, f in ok:
    print(f"  OK   {s}  {lang}/{voice}  ♪1 {d1}s ♪2 {d2}s  词{how}  {f}")
for s, f, why in bad:
    print(f"  FAIL {s}  {f}")
    for w in why: print(f"         - {w}")

print(f"\n汇总: 清单 {len(plan)} · 过 {len(ok)} · 不过 {len(bad)}")
if len(ok) + len(bad) != len(plan):
    sys.exit(f"FAIL: 过+不过 = {len(ok)+len(bad)} ≠ 清单 {len(plan)} —— 自己的账都对不上, 上面的数不要信")
print("清单与实际一致  " + ("OK —— 全过" if not bad else f"但有 {len(bad)} 首不过"))
sys.exit(1 if bad else 0)
