#!/usr/bin/env python3
"""W2149 执行 · 摘掉【没有任何轨选得中】的字幕语言条目。

判据与扫描器同一份(照抄引擎的三个匹配器), 这里不再重判, 只按 plan.json 干活。

备份放 backups/w2149/<work_id>/<basename> —— 【不】用 subtitle-take1--aXXX-pre-w2149.json
那种兄弟命名: 它会命中 '*/subtitle-take1--a*.json', 以后任何扫描都会把备份当成正片。
(平台惯例的 -pre-wNNNN.json 只对主字幕安全, 对快照不安全。)
"""
import json, os, subprocess, sys, hashlib

MODE = sys.argv[1] if len(sys.argv) > 1 else "dry"
B = "r2:cssos-artifacts"
plan = json.load(open("/tmp/w2149/plan.json"))

def run(c): return subprocess.run(c, shell=True, capture_output=True, text=True)

ok = bad = 0
for p in plan:
    key, path = p["key"], p["path"]
    wid = key.split("/")[1]
    base = os.path.basename(key)
    bkey = f"backups/w2149/{wid}/{base}"
    d = json.load(open(path, encoding="utf-8"))
    langs = d.get("languages") or []
    dropset = list(p["drop"])
    keep = []
    for L in langs:
        tag = str(L.get("lang") or "")
        if tag in dropset: dropset.remove(tag)       # 逐个匹配, 同名多条只摘计划里那几条
        else: keep.append(L)
    if len(keep) != len(p["keep"]):
        print(f"  ❌ {key} 计划留{len(p['keep'])}条实际{len(keep)}条 — 跳过"); bad += 1; continue
    if not keep:
        print(f"  ❌ {key} 会清空 — 跳过"); bad += 1; continue
    if MODE != "apply":
        print(f"  [干跑] {wid[:8]} {base[:24]:<24} 摘{p['drop']} → 留{[str(L.get('lang')) for L in keep]}")
        ok += 1; continue
    # ① 先备份原字节
    r = run(f"rclone copyto '{B}/{key}' '{B}/{bkey}'")
    if r.returncode: print(f"  ❌ {key} 备份失败"); bad += 1; continue
    # ② 写新内容
    d["languages"] = keep
    tmp = "/tmp/w2149/out.json"
    json.dump(d, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
    r = run(f"rclone copyto '{tmp}' '{B}/{key}'")
    if r.returncode: print(f"  ❌ {key} 写入失败"); bad += 1; continue
    # ③ 回读核对
    r = run(f"rclone cat '{B}/{key}'")
    try:
        back = json.loads(r.stdout)
        got = [str(L.get("lang") or "") for L in (back.get("languages") or [])]
        good = got == [str(L.get("lang") or "") for L in keep] and all(
            any(s.get("lines") for s in (L.get("sections") or [])) for L in (back.get("languages") or []))
    except Exception:
        good = False
    print(f"  {'✅' if good else '❌'} {wid[:8]} {base[:24]:<24} 摘{p['drop']} → 留{got}")
    ok += good; bad += (not good)
print(f"\n{'干跑' if MODE!='apply' else '执行'}完成: 成功 {ok} / 失败 {bad} / 共 {len(plan)}")
