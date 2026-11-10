#!/usr/bin/env python3
"""只读探查: 这两首的四处现状 + 字幕文件里到底标了什么、正文是什么文字。
判据照搬 audit-language-labels.py(同一套字形映射 + 逐行取多数), 不另造。"""
import os, json, subprocess, urllib.request, collections, re, csv, io
DB=os.environ['DATABASE_URL']; UA={'User-Agent':'cssos-audit/1.0'}
IDS=['80f26bbc','997aee2a']

def detect(t):
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
def major(t):
    c=collections.Counter()
    for ln in t.splitlines():
        s=ln.strip()
        if len(s)<4 or s.startswith('['): continue
        c[detect(s)]+=1
    if not c: return None,0,{}
    top,n=c.most_common(1)[0]
    return top,sum(c.values()),dict(c)

q=("COPY (select w.id, coalesce(w.language,''), coalesce(w.title,''), coalesce(w.lyrics_preview,''), "
   "coalesce(w.subtitle_take1_json_url,''), coalesce(w.subtitle_take2_json_url,''), coalesce(w.civilization,'') "
   "from user_works w where " + " or ".join(f"w.id::text like '{i}%'" for i in IDS) + ") TO STDOUT WITH (FORMAT csv)")
out=subprocess.run(['psql',DB,'-X','-q','-c',q],capture_output=True,text=True)
rows=[r for r in csv.reader(io.StringIO(out.stdout)) if len(r)>=7]
print(f"作品行命中 {len(rows)} 条  (清单 {len(IDS)})")
assert len(rows)==len(IDS), "命中数与清单不符 —— 停手"

plan=[]
for wid,lang,title,lyr,s1,s2,civ in rows:
    e1,nl,dist=major(lyr)
    print("="*78)
    print(f"{wid}  {title}")
    print(f"  ① 作品行 language = {lang!r}   歌词 {nl} 行多数 = {e1}  {dist}")
    nsec=len([l for l in lyr.splitlines() if re.match(r'^\[(Verse|Chorus|Bridge|Outro|Intro)\b', l.strip())])
    nbody=len([l for l in lyr.splitlines() if l.strip() and not l.strip().startswith('[')])
    print(f"     结构: {nsec} 节 / {nbody} 行正文   (完整度门槛 10 节 / 40 行)")
    tr=subprocess.run(['psql',DB,'-X','-q','-t','-A','-F','\t','-c',
        f"select id, coalesce(lang,''), coalesce(voice,''), is_default, coalesce(status,''), coalesce(audio_url,''), coalesce(subtitle_url,'') from work_language_tracks where work_id='{wid}' order by id"],
        capture_output=True,text=True).stdout.strip()
    tracks=[(l.split('\t')+['']*7)[:7] for l in tr.splitlines() if l.strip()]
    if tr.strip() and not tracks: print("  ⚠ 轨查询有输出但解析不出行 —— 原文:", repr(tr[:300]))
    print(f"  ② 语言轨 {len(tracks)} 条:")
    for t in tracks: print(f"       id={t[0]} lang={t[1]!r} voice={t[2]!r} default={t[3]} status={t[4]} sub={'有' if t[6] else '空'}")
    vr=subprocess.run(['psql',DB,'-X','-q','-t','-A','-F','\t','-c',
        f"select id, kind, coalesce(lang,''), coalesce(label,''), is_current, coalesce(subtitle_url,'') from work_media_versions where work_id='{wid}' order by kind,id"],
        capture_output=True,text=True).stdout.strip()
    print("  ②b 版本行:")
    for l in vr.splitlines():
        f=l.split('\t'); print(f"       id={f[0]} kind={f[1]} lang={f[2]!r} label={f[3]!r} current={f[4]}")
    docs=[]
    for kind,url in (('作品级take1',s1),('作品级take2',s2)):
        if not url: print(f"  ③ {kind}: (空)"); continue
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40) as r: d=json.loads(r.read().decode())
        except Exception as e:
            print(f"  ③ {kind}: 取不到 {type(e).__name__} —— 【判不了】不是【没有】"); continue
        L=d.get('languages') or []
        tags=[e.get('lang') for e in L]
        txt=[]
        for e in L[:1]:
            for s in (e.get('sections') or []):
                for ln in (s.get('lines') or []):
                    t=ln.get('text') or ''
                    if t and t!='[Music...]': txt.append(t)
        ss,sn,sd=major("\n".join(txt)) if txt else (None,0,{})
        print(f"  ③ {kind}: 标签={tags}  正文 {sn} 行多数={ss} {sd}")
        print(f"       头 3 行: {txt[:3]}")
        docs.append([kind,None,url])
    # 轨自己的快照字幕
    for t in tracks:
        if t[6]: docs.append([f"轨{t[0]}快照",None,t[6]])
    plan.append(dict(id=wid,lang=lang,new=e1,title=title,civ=civ,
                     track_langs=[t[1] for t in tracks],docs=docs))
json.dump(plan,open('/tmp/w2290-plan2.json','w'),ensure_ascii=False)
print("="*78)
print(f"计划 → /tmp/w2290-plan2.json  ({len(plan)} 条)  旧→新: "
      + ", ".join(f"{p['id'][:8]} {p['lang']}→{p['new']}" for p in plan))
