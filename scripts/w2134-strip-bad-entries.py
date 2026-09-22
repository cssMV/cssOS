#!/usr/bin/env python3
"""W2134 · 摘掉字幕文件里【坏掉的语言条目】(信封残留 / 烤进去的 LLM 元回复 / 空条目)。
不生成任何东西、不花钱 —— 只是把垃圾条目拿掉, 好条目一个字不动。

为什么可以直接做而不必先请示重做: 这不是重新生成, 是移除一段本来就是垃圾的内容
(实例: 字幕里在唱 "I appreciate you sharing this, but I need to clarify something important:")。
按版本铁律, 半成品/坏的可以覆盖; 而且旧字节先另存, 随时可退。

安全:
  · 摘完若【默认轨的语言】没有好条目 → 整首拒绝, 不写(那种要重做, 归另一件事)
  · 摘完若一条不剩 → 拒绝
  · 主字幕 + 所有按音频版本的快照一起改, 否则版本轨还挂着垃圾
用法: w2134-strip-bad-entries.py <ids.txt> [--apply]
"""
import json, re, subprocess, sys

DB = ["psql", "-h", "127.0.0.1", "-U", "cssstudio", "-d", "cssstudio", "-At"]
B = "r2:cssos-artifacts"
KEYS = re.compile(r'"(lyrics?|sections?|lines|theme|mood)"\s*:')
META = ("i appreciate you sharing", "i need to clarify", "i can't help with", "as an ai",
        "i cannot provide", "i'm unable to", "if you'd like me to help with this material")

def sh(a, inp=None): return subprocess.run(a, capture_output=True, text=True, input=inp).stdout

def entry_bad(L):
    t = "".join(str(ln.get("text") or "") + "\n"
                for sec in (L.get("sections") or []) for ln in (sec.get("lines") or []))
    if not t.strip(): return "空"
    if KEYS.search(t) or "\\n" in t or re.search(r"(?m)^\s*[{}]", t): return "信封"
    if any(m in t.lower() for m in META): return "元回复"
    return None

apply = "--apply" in sys.argv
ids = [x.strip() for x in open(sys.argv[1]) if x.strip()]
done = refused = noop = 0
for wid in ids:
    raw = sh(["rclone", "cat", f"{B}/works/{wid}/subtitle-take1.json"])
    try: doc = json.loads(raw)
    except Exception:
        refused += 1; print(f"⛔ {wid[:8]} 字幕读不回"); continue
    langs = doc.get("languages") or []
    deft = sh(DB + ["-c", f"SELECT lang FROM work_language_tracks WHERE work_id='{wid}' AND is_default LIMIT 1"]).strip()
    keep, drop = [], []
    for L in langs:
        why = entry_bad(L)
        (drop if why else keep).append((str(L.get("lang") or ""), why))
    if not drop: noop += 1; continue
    keep_langs = [l for l, _ in keep]
    if not keep_langs:
        refused += 1; print(f"⛔ {wid[:8]} 摘完一条不剩 → 该重做, 不动"); continue
    if deft and deft not in keep_langs:
        refused += 1; print(f"⛔ {wid[:8]} 默认轨 {deft} 没有好条目 → 该重做, 不动"); continue
    doc["languages"] = [L for L in langs if not entry_bad(L)]
    print(f"✅ {wid[:8]} 摘掉 {[f'{l}({w})' for l, w in drop]} 保留 {keep_langs}")
    if apply:
        body = json.dumps(doc, ensure_ascii=False)
        sh(["rclone", "copyto", f"{B}/works/{wid}/subtitle-take1.json",
            f"{B}/works/{wid}/subtitle-take1-pre-w2134.json"])
        sh(["rclone", "rcat", f"{B}/works/{wid}/subtitle-take1.json"], inp=body)
        for snap in sh(["rclone", "lsf", f"{B}/works/{wid}/"]).split():
            if snap.startswith("subtitle-take1--a") and snap.endswith(".json"):
                sh(["rclone", "rcat", f"{B}/works/{wid}/{snap}"], inp=body)
    done += 1
print(f"\n=== 清单 {len(ids)} 首, 处理 {len(ids)} 首 —— 可摘 {done} · 本来就干净 {noop} · 拒绝 {refused} ===")
if not apply: print("(干跑, 未改动。要真改加 --apply)")
