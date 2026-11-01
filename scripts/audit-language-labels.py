#!/usr/bin/env python3
"""巡检 — 作品的【语言标签】有没有说实话。 (W2265, 2026-11-01)

在 api-vm 上跑: `set -a; . /etc/cssos.env; set +a; python3 -I scripts/audit-language-labels.py`
只读, 一个字不写。发现可改项时退出码 1(可挂 cron / 当回归用)。

为什么要巡检这件事: 播放端按 W1961【严格匹配】取字幕 —— 轨说 zh、字幕文件标 en 就整首哑掉,
不报错、不降级、不回退。标签写错的代价不是"显示得不准", 是"根本不显示", 而且只有人眼能发现。
W2265 那次是 442 个作品同时错着, 没有任何告警。

判据【不另造一套】: 照搬 src/index.ts:41428 detectLyricLang 的字形映射(字幕写入侧用的就是它),
但【逐行取多数】—— 京典模版每节都夹一两行拉丁/希腊古老咒语, 整段式判定会被少数行劫持。
同文字不同语言(sa/hi、ar/fa)一律采信作品行声明, 这是 W2030 定下的: 字形只能定文字, 定不了语言。

两份独立证据(歌词字形 / 字幕正文字形)不一致的, 列进【搁置】而不是猜 —— 那种通常是
「词是中文但实际唱的是英文」, 改标签治不了, 要的是重做, 而重做必须先问 Jing。

修复走 scripts/w2265-fix-language-labels.py(默认干跑, --apply 才真写)。
"""
import os, subprocess, csv, io, json, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
DB=os.environ['DATABASE_URL']; UA={'User-Agent':'cssos-audit/1.0'}

def detect(t):   # 照抄 detectLyricLang
    import re
    if re.search(r'[가-힯]',t): return 'ko'
    if re.search(r'[぀-ヿ]',t): return 'ja'
    if re.search(r'[一-鿿]',t): return 'zh'
    if re.search(r'[؀-ۿݐ-ݿ]',t): return 'fa'
    if re.search(r'[Ѐ-ӿ]',t): return 'ru'
    if re.search(r'[Ͱ-Ͽ]',t): return 'el'
    if re.search(r'[֐-׿]',t): return 'he'
    if re.search(r'[ऀ-ॿ]',t): return 'hi'
    if re.search(r'[฀-๿]',t): return 'th'
    return 'en'

# 整段式检测: 对【每一行】判一次, 取多数 —— 京典模版的古老咒语(拉丁/希腊各一两行)
# 不能把整首中文歌拽成 el。detectLyricLang 是"见到就返回", 用在整首上会被少数行劫持。
def detect_major(t):
    c=collections.Counter()
    for ln in t.splitlines():
        s=ln.strip()
        if len(s)<4 or s.startswith('['): continue
        c[detect(s)]+=1
    if not c: return None, 0, {}
    top,n=c.most_common(1)[0]
    return top, sum(c.values()), dict(c)

FAM={'sa':'deva','hi':'deva','mr':'deva','ne':'deva','ar':'arab','fa':'arab','ur':'arab','ps':'arab',
     'ru':'cyrl','sr':'cyrl','bg':'cyrl','uk':'cyrl','zh':'hani','ja':'jpan','ko':'kore',
     'el':'grek','he':'hebr','th':'thai'}
fam=lambda l: FAM.get((l or '').lower().split('-')[0], 'latn' if l else None)

q="""COPY (select w.id, coalesce(w.language,''), coalesce(w.title,''),
        coalesce(w.lyrics_preview,''), coalesce(w.subtitle_take1_json_url,''),
        coalesce(w.civilization,''),
        (select count(*) from work_language_tracks t where t.work_id=w.id)
      from user_works w) TO STDOUT WITH (FORMAT csv)"""
rows=[r for r in csv.reader(io.StringIO(subprocess.run(['psql',DB,'-X','-q','-c',q],capture_output=True,text=True).stdout)) if len(r)>=7]

cand=[]
for wid,lang,title,lyr,suburl,civ,ntr in rows:
    lang=lang.strip()
    if not lang: continue
    e1,nl,dist=detect_major(lyr)
    if not e1 or nl<6: continue
    if fam(lang)==fam(e1): continue        # 同文字 → W2030: 采信声明, 不动
    cand.append(dict(id=wid,lang=lang,title=title,e1=e1,nlines=nl,dist=dist,
                     sub=suburl,civ=civ,ntr=int(ntr)))
print(f"字形与声明【不同文字】的候选: {len(cand)}")

def e2(c):
    if not c['sub']: return c
    try:
        with urllib.request.urlopen(urllib.request.Request(c['sub'],headers=UA),timeout=30) as r:
            d=json.loads(r.read().decode())
        L=d.get('languages') or []
        c['sub_langs']=[e.get('lang') for e in L]
        txt=[]
        for e in L[:1]:
            for s in (e.get('sections') or [])[:8]:
                for ln in (s.get('lines') or [])[:10]:
                    t=ln.get('text') or ''
                    if t and t!='[Music...]': txt.append(t)
        c['sub_script']=detect_major("\n".join(txt))[0] if txt else None
    except Exception as ex: c['sub_err']=type(ex).__name__
    return c
cand=list(ThreadPoolExecutor(8).map(e2,cand))

fix=[]; hold=[]
for c in cand:
    ss=c.get('sub_script'); sl=c.get('sub_langs')
    if ss and ss!=c['e1']: c['why']=f"两份证据打架: 歌词字形={c['e1']} 字幕正文字形={ss}"; hold.append(c); continue
    c['evidence']=f"歌词{c['nlines']}行多数={c['e1']}{c['dist']}" + (f" · 字幕正文字形={ss} 标签={sl}" if ss else " · 无字幕可佐证")
    c['new']=c['e1']; fix.append(c)
print(f"  可改 {len(fix)} · 证据打架先搁置 {len(hold)}\n")
print("【可改】按 旧→新 归类:")
for (o,n),v in collections.Counter((c['lang'],c['new']) for c in fix).most_common():
    sample=[c for c in fix if c['lang']==o and c['new']==n][:3]
    print(f"  {v:4d}  {o} → {n}")
    for s in sample: print(f"          {s['id']} {s['title'][:34]:<34} civ={s['civ'][:14]:<14} 轨{s['ntr']} {s['evidence'][:72]}")
if hold:
    print("\n【搁置】:")
    for c in hold[:20]: print(f"   {c['id']} {c['lang']} {c['title'][:36]} — {c['why']}")
json.dump(fix, open('/tmp/w2265-plan.json','w'))
json.dump(hold, open('/tmp/w2265-hold.json','w'))
print(f"\n计划 → /tmp/w2265-plan.json ({len(fix)}) · 搁置 → /tmp/w2265-hold.json ({len(hold)})")

import sys as _sys
_sys.exit(1 if fix else 0)
