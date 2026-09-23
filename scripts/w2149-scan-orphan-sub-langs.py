#!/usr/bin/env python3
"""W2149 扫描(只读) · 找出【没有任何轨选得中】的字幕语言条目。

判据必须照抄引擎 app.emotion-subtitle-engine.js:123-163 的三个匹配器, 不能按名字长相猜:
  ① 精确      l.lang === track.lang
  ② 归一化    _norm(l.lang) === _norm(track.lang)   —— _norm 按 '-' 截断!
                于是 'orig-pre-epic' 归一成 'orig' —— lang='orig' 的轨【选得中它】。
  ③ 单条兜底  文件只剩 1 条且标签是占位符时, 任何轨都可能落到它上面。
     所以【摘到只剩 1 条占位符】会凭空武装这条兜底 = 改变行为 → 这种文件跳过不动。
"""
import json, os, subprocess, sys, collections

def norm(x):
    v = str(x or "").lower().replace("_", "-")
    return v.split("-")[0] or v

PLACE = {"", "orig", "auto", "und"}

out = subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","|",
                      "-c","SELECT work_id, lang FROM work_language_tracks"],
                     capture_output=True, text=True, env={**os.environ,"PGPASSWORD":"Au#20016"})
tracks = collections.defaultdict(set)
for line in out.stdout.strip().split("\n"):
    if "|" in line:
        w, l = line.split("|", 1)
        tracks[w].add(l)

root = "/tmp/w2149/files"
stat = collections.Counter()
drop_by_tag = collections.Counter()
plan = []
for dirpath, _, names in os.walk(root):
    wid = os.path.basename(dirpath)
    for n in names:
        if not n.startswith("subtitle-take1"): continue
        p = os.path.join(dirpath, n)
        try:
            d = json.load(open(p, encoding="utf-8"))
        except Exception:
            stat["解析失败"] += 1; continue
        langs = d.get("languages") or []
        if not langs: stat["文件无 languages"] += 1; continue
        tl = tracks.get(wid, set())
        if not tl: stat["库里没有这首的轨(跳过)"] += 1; continue
        wanted  = {str(t) for t in tl}
        wantedn = {norm(t) for t in tl}
        keep, drop = [], []
        for L in langs:
            tag = str(L.get("lang") or "")
            (keep if (tag in wanted or norm(tag) in wantedn) else drop).append(L)
        if not drop: stat["全都有人选中(不动)"] += 1; continue
        if not keep:
            stat["摘完一条不剩(跳过)"] += 1; continue
        if len(keep) == 1 and str(keep[0].get("lang") or "").lower() in PLACE:
            stat["摘完只剩单条占位符→会凭空武装兜底(跳过)"] += 1; continue
        stat["可清理"] += 1
        for L in drop: drop_by_tag[str(L.get("lang") or "(空)")] += 1
        plan.append({"key": f"works/{wid}/{n}", "path": p,
                     "drop": [str(L.get('lang') or '') for L in drop],
                     "keep": [str(L.get('lang') or '') for L in keep]})

print("── 扫描结果(只读)")
for k, v in stat.most_common(): print(f"   {k:<38} {v}")
print("\n── 将被摘掉的条目标签 Top")
for k, v in drop_by_tag.most_common(14): print(f"   {k:<18} {v}")
json.dump(plan, open("/tmp/w2149/plan.json","w"), ensure_ascii=False)
print(f"\n计划写入文件数 {len(plan)}  → /tmp/w2149/plan.json")
