#!/usr/bin/env python3
"""核对字幕文件: 新件标签必须是 zh; 备份件必须还在、且还标 en;
   除了那一个标签, 正文必须一个字没动(逐节逐行逐字比)。"""
import json, urllib.request, sys
UA={'User-Agent':'cssos-audit/1.0'}
WORKS=[("80f26bbc","80f26bbc-09f2-4cc4-9b09-80c5ee690d2a"),
       ("997aee2a","997aee2a-3cee-49ad-95c5-84f4be31adad")]
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40) as r: return json.loads(r.read().decode())
bad=0
for pre,wid in WORKS:
    live=f"https://cdn.cssstudio.app/works/{wid}/subtitle-take1.json"
    bkey=f"artifacts/audit/w2265/{wid}--works_{wid}_subtitle-take1.json"
    bak=f"https://cdn.cssstudio.app/{bkey}"
    try: A=get(live)
    except Exception as e: print(f"FAIL {pre} 新件取不到: {type(e).__name__} —— 【判不了】"); bad+=1; continue
    try: B=get(bak)
    except Exception as e: print(f"FAIL {pre} 备份件取不到: {type(e).__name__} —— 【判不了】"); bad+=1; continue
    ta=[e.get('lang') for e in (A.get('languages') or [])]
    tb=[e.get('lang') for e in (B.get('languages') or [])]
    ok_tag = ta==['zh'] and tb==['en']
    # 把标签抹平后整份比 —— 相等 = 除标签外一个字没动
    import copy
    a2=copy.deepcopy(A); b2=copy.deepcopy(B)
    for d in (a2,b2):
        for e in (d.get('languages') or []): e['lang']='<抹平>'
    same = json.dumps(a2,sort_keys=True,ensure_ascii=False)==json.dumps(b2,sort_keys=True,ensure_ascii=False)
    nl=sum(len(s.get('lines') or []) for e in (A.get('languages') or []) for s in (e.get('sections') or []))
    print(f"{'OK  ' if (ok_tag and same) else 'FAIL'} {pre}  新件标签={ta} 备份件标签={tb}  抹平标签后全文相同={same}  共 {nl} 行")
    if not (ok_tag and same): bad+=1
print(f"\n清单 {len(WORKS)} 首 · 实际核对 {len(WORKS)} 首 · 不合格 {bad}")
sys.exit(1 if bad else 0)
