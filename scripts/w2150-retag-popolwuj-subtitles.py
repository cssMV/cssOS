#!/usr/bin/env python3
"""W2150 ① · Popol Wuj 三部曲: 把字幕文件里贴错的 'zh' 标签改回轨的真实语言 'quc'。

证据(不是眼看, 是量出来的): 字幕正文与轨的 lyrics 重合 83~88%, 正文就是基切语歌词本身
(Junajpu, Xb'alamke kaqasaj qib'…)。标签却写着 zh, 而轨是 quc —— 引擎严格匹配对不上,
三首【已发布】作品的字幕做好了摆在那里, 用户一行看不到。

安全:
 · 三首各只有一条轨 quc/auto, 【没有 zh 轨】—— 改标签不会抢走任何人的字幕。
 · 只动 languages[].lang 这一个字符串, 正文/时间轴一个字节不碰(改完逐行核对行数与正文哈希)。
 · 原字节备份到 backups/w2150/<work_id>/<basename>(不用 -pre-*.json 兄弟命名,
   那会命中 '*/subtitle-take1--a*.json', 以后扫描把备份当正片 —— W2149 的教训)。
用法: python3 w2150_retag.py [dry|apply]
"""
import json, subprocess, sys, hashlib
MODE = sys.argv[1] if len(sys.argv) > 1 else "dry"
B = "r2:cssos-artifacts"
WORKS = {"767cca0e-9c13-4407-98c3-f17b6297b99e": "quc",
         "c5ab48df-1157-4b0b-b516-6c0db2dde0be": "quc",
         "9a1e578a-a2e7-4149-afd1-d614349f1b40": "quc"}
OLD = "zh"
def run(c): return subprocess.run(c, shell=True, capture_output=True, text=True)
def body_sig(d):
    """正文+时间轴指纹 —— 只应随标签改变而【不变】。"""
    h = hashlib.sha1()
    for L in d.get("languages") or []:
        for s in (L.get("sections") or []):
            for ln in (s.get("lines") or []):
                h.update(str(ln.get("text") or "").encode())
                h.update(str(ln.get("t_start")).encode()); h.update(str(ln.get("t_end")).encode())
    return h.hexdigest()[:12]

ok = bad = 0
for wid, new in WORKS.items():
    r = run(f"rclone lsf {B}/works/{wid}/ --files-only")
    files = [f for f in r.stdout.split() if f.startswith("subtitle-take1") and "-pre-" not in f]
    for f in files:
        key = f"works/{wid}/{f}"
        r = run(f"rclone cat '{B}/{key}'")
        try: d = json.loads(r.stdout)
        except Exception: print(f"  ❌ {key} 读不到"); bad += 1; continue
        tags = [str(L.get("lang") or "") for L in (d.get("languages") or [])]
        if tags != [OLD]:
            print(f"  ⏭ {wid[:8]} {f[:26]:<26} 条目是 {tags}, 不是纯 ['{OLD}'] — 跳过不猜"); continue
        sig0, n0 = body_sig(d), sum(len(s.get("lines") or []) for L in d["languages"] for s in (L.get("sections") or []))
        if MODE != "apply":
            print(f"  [干跑] {wid[:8]} {f[:26]:<26} {tags} → ['{new}']  行{n0} 正文指纹{sig0}")
            ok += 1; continue
        if run(f"rclone copyto '{B}/{key}' '{B}/backups/w2150/{wid}/{f}'").returncode:
            print(f"  ❌ {key} 备份失败"); bad += 1; continue
        d["languages"][0]["lang"] = new
        json.dump(d, open("/tmp/w2150_out.json", "w", encoding="utf-8"), ensure_ascii=False)
        if run(f"rclone copyto /tmp/w2150_out.json '{B}/{key}'").returncode:
            print(f"  ❌ {key} 写入失败"); bad += 1; continue
        r = run(f"rclone cat '{B}/{key}'")
        try: back = json.loads(r.stdout)
        except Exception: print(f"  ❌ {key} 回读失败"); bad += 1; continue
        t1 = [str(L.get("lang") or "") for L in (back.get("languages") or [])]
        sig1 = body_sig(back)
        n1 = sum(len(s.get("lines") or []) for L in back["languages"] for s in (L.get("sections") or []))
        good = (t1 == [new]) and (sig1 == sig0) and (n1 == n0)
        print(f"  {'✅' if good else '❌'} {wid[:8]} {f[:26]:<26} {tags}→{t1} 行{n0}→{n1} 正文指纹{sig0}→{sig1}")
        ok += good; bad += (not good)
print(f"\n{'干跑' if MODE!='apply' else '执行'}完成: 成功 {ok} / 失败 {bad}")
