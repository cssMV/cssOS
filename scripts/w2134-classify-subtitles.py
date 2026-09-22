#!/usr/bin/env python3
"""W2134 · 把全库字幕按【病种】分类。一次扫描, 各病各计数, 不混用判据。
起因: 信封扫描器报 22 首, 标签规划器在 ready+published 里就拒了 41 首 —— 两个数字对不上,
      因为它们查的不是同一种病。任何一个都不能单独当结论。

病种(互不替代, 按严重度排序, 一首可同时中多项但只归首要那项):
  envelope   字幕里有 LLM 的 JSON 信封残留 ("lyrics": / "sections": / 字面 \\n / 花括号行)
  llm_meta   烤进了 LLM 的元回复/拒答("I appreciate you sharing this, but I need to clarify…")
  spaced     文本被逐字母拆开('T h e s t a g e o p e n s')—— 非 CJK 才算, CJK 逐字是正常的
  empty      有文件但一条唱词都没有
  ok         没查出问题
"""
import json, re, subprocess, sys
from collections import Counter

DB = ["psql", "-h", "127.0.0.1", "-U", "cssstudio", "-d", "cssstudio", "-At"]
KEYS = re.compile(r'"(lyrics?|sections?|lines|theme|mood)"\s*:')
META = ("i appreciate you sharing", "i need to clarify", "i can't help with", "as an ai",
        "i cannot provide", "i'm unable to", "if you'd like me to help with this material")
CJK = re.compile(r"[぀-ヿ一-鿿가-힯]")

def sh(a, inp=None): return subprocess.run(a, capture_output=True, text=True, input=inp).stdout

def spaced(t):
    """逐字母拆开。只对【非 CJK】文本判 —— 中日韩字幕本就逐字, 拿这条去判必误伤。"""
    if CJK.search(t): return False
    toks = t.split()
    if len(toks) < 8: return False
    return sum(1 for x in toks if len(x) == 1) / len(toks) > 0.5

rows = [r.split("|") for r in sh(DB + ["-F", "|", "-c",
    "SELECT w.id::text, COALESCE(w.status,'-'), COALESCE(w.title,'-'), w.subtitle_take1_json_url "
    "FROM user_works w WHERE COALESCE(w.subtitle_take1_json_url,'')<>'' ORDER BY w.created_at"
    ]).strip().split("\n") if r.strip()]

tally, per_status, out = Counter(), {}, []
for wid, st, title, url in rows:
    raw = sh(["curl", "-s", "--max-time", "30", url])
    try: doc = json.loads(raw)
    except Exception:
        tally["unreadable"] += 1; out.append((wid, st, title, "unreadable", "")); continue
    lines_txt, per_entry = [], []
    for L in (doc.get("languages") or []):
        t = ""
        for sec in (L.get("sections") or []):
            for ln in (sec.get("lines") or []):
                s = str(ln.get("text") or "")
                if s: t += s + "\n"
                for tk in (ln.get("tokens") or []):
                    c = str(tk.get("char") or tk.get("text") or "")
                    if c: t += c
        per_entry.append((str(L.get("lang") or ""), t))
        lines_txt.append(t)
    blob = "\n".join(lines_txt)
    kind = "ok"
    if not blob.strip():                          kind = "empty"
    elif KEYS.search(blob) or "\\n" in blob or re.search(r"(?m)^\s*[{}]", blob): kind = "envelope"
    elif any(m in blob.lower() for m in META):    kind = "llm_meta"
    elif any(spaced(t) for _, t in per_entry):    kind = "spaced"
    tally[kind] += 1
    per_status.setdefault(kind, Counter())[st] += 1
    if kind != "ok": out.append((wid, st, title, kind, ",".join(l for l, _ in per_entry)))

print(f"=== 全库字幕分类: 清单 {len(rows)} 首, 实际查了 {len(rows)} 首 ===")
for k, v in tally.most_common():
    detail = " ".join(f"{s}:{c}" for s, c in sorted(per_status.get(k, {}).items())) if k != "ok" else ""
    print(f"  {k:<11} {v:5d}   {detail}")
with open("/tmp/w2134-bad.tsv", "w") as f:
    for r in out: f.write("\x1f".join(r) + "\n")
print(f"\n有问题的清单({len(out)} 首)写入 /tmp/w2134-bad.tsv")
print("--- 用户看得见的(ready/published)逐首 ---")
for wid, st, title, kind, tags in out:
    if st in ("ready", "published"):
        print(f"  {wid[:8]} [{st:<9}] {kind:<9} 标签[{tags}]  {title[:30]}")
