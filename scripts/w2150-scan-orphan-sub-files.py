#!/usr/bin/env python3
"""W2150 · 把「摘完一条不剩」的孤儿字幕文件查清楚(只读)。
孤儿 = 文件里【每一条】语言条目都没有任何该作品的轨选得中(三个匹配器全模拟)。"""
import json, os, subprocess, collections
def norm(x):
    v=str(x or "").lower().replace("_","-"); return v.split("-")[0] or v
PLACE={"","orig","auto","und"}
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","|","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]

tracks=collections.defaultdict(list)
for line in psql("SELECT work_id, lang, voice, status, coalesce(subtitle_url,''), "
                 "case when coalesce(audio_url,'')='' then 'noaudio' else 'aud' end "
                 "FROM work_language_tracks"):
    p=line.split("|")
    if len(p)>=6: tracks[p[0]].append(tuple(p[1:6+1][:5]))

meta={}
for line in psql("SELECT id, status, coalesce(language,''), replace(left(title,26),'|','/'), "
                 "case when coalesce(subtitle_take1_json_url,'')='' then 'no' else 'yes' end FROM user_works"):
    p=line.split("|")
    if len(p)>=5: meta[p[0]]=(p[1],p[2],p[3],p[4])

root="/tmp/w2149/files"; orph=[]
for dirpath,_,names in os.walk(root):
    wid=os.path.basename(dirpath)
    for n in names:
        if not n.startswith("subtitle-take1"): continue
        try: d=json.load(open(os.path.join(dirpath,n),encoding="utf-8"))
        except Exception: continue
        langs=d.get("languages") or []
        tl=tracks.get(wid)
        if not langs or not tl: continue
        wanted={t[0] for t in tl}; wantedn={norm(t[0]) for t in tl}
        keep=[L for L in langs if str(L.get("lang") or "") in wanted or norm(L.get("lang")) in wantedn]
        if keep: continue
        lines=sum(len(s.get("lines") or []) for L in langs for s in (L.get("sections") or []))
        orph.append((wid,n,[str(L.get("lang") or "(空)") for L in langs],lines,tl))

print("孤儿文件 %d 个\n" % len(orph))
for wid,n,tags,lines,tl in orph:
    st,lg,title,haswl=meta.get(wid,("?","?","(库里没有这个作品)","?"))
    kind="主字幕" if n=="subtitle-take1.json" else "版本快照"
    print("══ %s  %s  [%s/%s]" % (title, wid[:8], st, kind))
    print("   文件语言条目: %s   总行数 %d" % (tags, lines))
    print("   该作品的轨   : %s" % ([ "%s/%s(%s,%s,%s)" % (a,b,c,"有字幕" if d else "无字幕",e) for a,b,c,d,e in tl ],))
