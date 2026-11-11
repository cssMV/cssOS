#!/usr/bin/env python3
"""打印一份字幕里【指定那门语言】最后一个字的结束秒数。取不到就打 "?"。
整份文件取 max 是错的 —— 一份文件可以装多种语言(W2293: 我因此点名了一个
其实准到 -0.2s 的版本, 同时漏掉真正越界的四种语言)。"""
import json, sys

try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    print("?"); raise SystemExit(0)
want = (sys.argv[2] if len(sys.argv) > 2 else "").strip().lower()
L = d.get("languages")
if not isinstance(L, list):
    print("?"); raise SystemExit(0)
hit = [x for x in L if str(x.get("lang", "")).strip().lower() == want]
if not hit and len(L) == 1 and not want:
    hit = L          # 单语言且没给 lang: 只此一种, 不算猜
if not hit:
    print("?"); raise SystemExit(0)
ends = []
for lg in hit:
    for s in (lg.get("sections") or []):
        for ln in (s.get("lines") or []):
            for t in (ln.get("tokens") or []):
                v = t.get("t_end")
                if isinstance(v, (int, float)):
                    ends.append(float(v))
print(f"{max(ends)/1000:.1f}" if ends else "?")
