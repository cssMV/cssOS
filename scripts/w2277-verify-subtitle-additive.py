#!/usr/bin/env python3
"""W2277 —— 核对新增母语轨【没有动到中文那一条】。

两头都判(audit-must-report-its-own-gaps): ① 新语言必须真的出现了;
② 改前就有的每一条语言必须【逐字段一致】—— 不是「看起来还在」, 是逐字段比。
改前的原件取自 R2 的 w2277 备份, 不取库里的当前值(拿当前值比当前值是同义反复)。
"""
import json, sys, urllib.request, hashlib

def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Macintosh) cssos-audit"})
    with urllib.request.urlopen(r, timeout=90) as f: return json.loads(f.read().decode("utf-8"))

def fp(entry):
    """一条语言的指纹: 语言码 + 每节的 tag/行数 + 全部 token 的 字/起/止。"""
    h = hashlib.sha1()
    h.update(str(entry.get("lang")).encode())
    for s in entry.get("sections") or []:
        h.update(("|S:" + str(s.get("tag")) + ":" + str(len(s.get("lines") or []))).encode())
        for ln in s.get("lines") or []:
            for t in ln.get("tokens") or []:
                h.update(("|" + str(t.get("char")) + ":" + str(t.get("t_start")) + ":" + str(t.get("t_end"))).encode())
    return h.hexdigest()[:10]

wid, want = sys.argv[1], sys.argv[2]
pre  = get(f"https://cdn.cssstudio.app/artifacts/audit/w2277/{wid}--subtitle-take1-pre.json")
post = get(f"https://cdn.cssstudio.app/works/{wid}/subtitle-take1.json?cb={__import__('time').time()}")
P = {l["lang"]: l for l in pre.get("languages", [])}
Q = {l["lang"]: l for l in post.get("languages", [])}
print(f"{wid[:8]}  改前 {sorted(P)} → 改后 {sorted(Q)}")
bad = 0
if want not in Q:
    print(f"  FAIL: 新语言 {want} 没出现在字幕文件里"); bad += 1
else:
    e = Q[want]
    nl = sum(len(s.get("lines") or []) for s in e.get("sections") or [])
    nt = sum(len(ln.get("tokens") or []) for s in e.get("sections") or [] for ln in s.get("lines") or [])
    ends = [t.get("t_end") for s in e.get("sections") or [] for ln in s.get("lines") or [] for t in ln.get("tokens") or [] if t.get("t_end")]
    print(f"  新增 {want}: {len(e.get('sections') or [])} 节 / {nl} 行 / {nt} token / 末尾 {max(ends)/1000.0 if ends else 0:.1f}s")
for lg in sorted(P):
    if lg not in Q:
        print(f"  FAIL: 改前有的 {lg} 不见了"); bad += 1; continue
    a, b = fp(P[lg]), fp(Q[lg])
    print(f"  旧 {lg}: {a} vs {b}  {'逐字段一致 OK' if a == b else 'FAIL 被改了'}")
    if a != b: bad += 1
sys.exit(1 if bad else 0)
