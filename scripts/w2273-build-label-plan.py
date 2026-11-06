#!/usr/bin/env python3
"""W2273 — 给【巡检看不见的那一类作品】补一份 w2265 的计划条目。

补的是哪个漏: scripts/audit-language-labels.py 第 62 行是 `if not lang: continue`
—— 它只抓【标错】的, 抓不到【根本没标】的。实测全库 624 个作品 user_works.language
是空的, 一个都没进过那 442 的候选名单。

空着多数时候不要紧(385 个是「作品行空、但轨自己写了真语言码」—— 播放端读的是轨),
要紧的是【连一条语言轨都没有】的那类: 伪轨的 lang 由 `String(w.language || "orig")`
兜出来(src/index.ts 的 language-tracks 端点), 作品行一空就回落成占位符 orig。
首例是两首《杜甫·登高三部曲 · 潦倒停杯》(e84a86a7… / 0b3f51de…), 由
scripts/audit-take-subtitles.py 报 BORROWED 时才顺带露出来。

用它配 scripts/w2265-fix-language-labels.py: 把产出的条目并进 /tmp/w2265-plan2.json,
再 `--only <那几个 id>` 跑。四处(作品行 / 轨 / 版本行 / 字幕 JSON)由那个脚本一起改,
备份与回滚也归它 —— 这里只负责【判语言 + 建条目】, 不写任何东西。

判据不另造: 直接 exec 出 audit-language-labels.py 里 detect / detect_major / FAM / fam
那一段原文, 对不上就当场报错 —— 绝不手抄一份(抄一份就是造一份, W1960)。
"""
import os, sys, json, re, collections, subprocess, urllib.request

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit-language-labels.py")
src = open(SRC, encoding="utf-8").read()
a = src.index("def detect(t):")
b = src.index("q=\"\"\"COPY")
block = src[a:b]
for need in ("def detect(t):", "def detect_major(t):", "FAM=", "fam="):
    if need not in block:
        sys.exit("FAIL: 没能从 %s 抽出 %r —— 文件结构变了, 先去看它" % (SRC, need))
ns = {"collections": collections, "re": re}
exec(block, ns)
detect_major = ns["detect_major"]; fam = ns["fam"]

if len(sys.argv) < 4:
    sys.exit("用法: w2273-build-label-plan.py <库里查出的现状.json> <输出计划.json> <workId[,workId...]>\n"
             "  现状 JSON 由 scripts/w2273-label-state.sql 查出(每个 id 一个对象: "
             "title/language/civilization/lyrics/sub/sub2/ntracks)")
WORKS = [w.strip() for w in sys.argv[3].split(",") if w.strip()]
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"}

meta = json.load(open(sys.argv[1], encoding="utf-8"))   # 库里查出来的现状
missing = [w for w in WORKS if w not in meta]
if missing: sys.exit("FAIL: 现状 JSON 里没有这些作品: %s" % missing)
out = []
for w in WORKS:
    m = meta[w]
    e1, nl, dist = detect_major(m["lyrics"])
    print("=== %s %s" % (w, m["title"]))
    print("   歌词 %d 行 多数=%s 分布=%s" % (nl, e1, dist))
    # 字幕正文字形佐证 —— 与审计 e2() 同一套取法
    txt = []
    doc = json.loads(urllib.request.urlopen(
        urllib.request.Request(m["sub"], headers=UA), timeout=40).read().decode())
    L = doc.get("languages") or []
    for e in L[:1]:
        for s in (e.get("sections") or [])[:8]:
            for ln in (s.get("lines") or [])[:10]:
                t = ln.get("text") or ""
                if t and t != "[Music...]": txt.append(t)
    ss = detect_major("\n".join(txt))[0] if txt else None
    tags = [e.get("lang") for e in L]
    print("   字幕标签=%s 正文字形=%s (取到 %d 行正文)" % (tags, ss, len(txt)))
    if ss and ss != e1:
        sys.exit("FAIL %s: 两份证据打架 歌词=%s 字幕正文=%s —— 按 w2265 的规矩该搁置, 不改" % (w, e1, ss))
    if nl < 6:
        sys.exit("FAIL %s: 只认出 %d 行歌词, 太少, 不判" % (w, nl))
    if len(tags) != 1:
        sys.exit("FAIL %s: 字幕里有 %s 多种语言 —— 不猜改哪一条" % (w, tags))
    out.append(dict(id=w, lang=m["language"], title=m["title"], e1=e1, nlines=nl, dist=dist,
                    sub=m["sub"], civ=m["civilization"], ntr=m["ntracks"],
                    sub_langs=tags, sub_script=ss,
                    evidence="歌词%d行多数=%s%s · 字幕正文字形=%s 标签=%s" % (nl, e1, dist, ss, tags),
                    new=e1, track_langs=[], docs=[["作品级", None, m["sub"]]]))
    print("   → new=%s (旧值 %r)  轨数=%s" % (e1, m["language"], m["ntracks"]))

json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
print("\n计划 %d 条 → %s" % (len(out), sys.argv[2]))
