#!/usr/bin/env python3
"""W2274 — 给【文件标签是占位符 orig、轨已经是真语言码】那一类建 w2265 计划。

与 w2273-build-label-plan.py 的分工:
  w2273  无语言轨的作品(第一半在 user_works.language)
  w2274  有轨、轨的 lang 已是真码, 坏的只是【字幕文件那一半】

判据照搬 audit-language-labels.py 的 detect_major/fam 原文(exec, 不手抄)。
任何一处拿不准就整条 bail —— 宁可少修一首, 不要把对的改成错的。

用法: w2274-build-plan.py <out-plan.json> <wid8[,wid8...]>
"""
import os, sys, json, re, collections, subprocess, csv, io, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE,"audit-language-labels.py")
src=open(SRC,encoding="utf-8").read()
blk=src[src.index("def detect(t):"):src.index('q="""COPY')]
for n in ("def detect(t):","def detect_major(t):","FAM=","fam="):
    if n not in blk: sys.exit(f"FAIL: 没能从 {SRC} 抽出 {n!r} —— 文件结构变了, 先去看它")
ns={"collections":collections,"re":re}; exec(blk,ns)
detect_major, fam = ns["detect_major"], ns["fam"]

OUT, WIDS = sys.argv[1], sys.argv[2].split(",")
DB=os.environ["DATABASE_URL"]; UA={"User-Agent":"Mozilla/5.0 (Macintosh) cssos-audit"}
PLACE=",".join("'%s'"%w for w in WIDS)
def q(sql):
    r=subprocess.run(["psql",DB,"-X","-q","-c",sql],capture_output=True,text=True)
    if r.returncode: sys.exit("psql: "+r.stderr[:300])
    return [x for x in csv.reader(io.StringIO(r.stdout)) if x]
def fetch(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60) as r: return r.read()

W={r[0]:dict(id=r[0],title=r[1],language=r[2],civ=r[3],lyrics=r[4],take1=r[5],take2=r[6])
   for r in q("COPY (select w.id, coalesce(w.title,''), coalesce(w.language,''), coalesce(w.civilization,''),"
              " coalesce(w.lyrics_preview,''), coalesce(w.subtitle_take1_json_url,''),"
              " coalesce(w.subtitle_take2_json_url,'') from user_works w"
              f" where left(w.id::text,8) in ({PLACE})) TO STDOUT WITH (FORMAT csv)") if len(r)>=7}
TR=collections.defaultdict(list)
for r in q("COPY (select t.work_id, coalesce(t.lang,''), coalesce(t.voice,'auto'), coalesce(t.subtitle_url,''),"
           " length(coalesce(t.lyrics,'')), coalesce(t.status,'') from work_language_tracks t"
           f" where left(t.work_id::text,8) in ({PLACE})) TO STDOUT WITH (FORMAT csv)"):
    if len(r)>=6: TR[r[0]].append(dict(lang=r[1],voice=r[2],sub=r[3],lyr=int(r[4]),status=r[5]))
VR=collections.defaultdict(list)
for r in q("COPY (select v.work_id, v.id, v.kind, coalesce(v.lang,''), coalesce(v.subtitle_url,'') from"
           f" work_media_versions v where left(v.work_id::text,8) in ({PLACE})) TO STDOUT WITH (FORMAT csv)"):
    if len(r)>=5: VR[r[0]].append(dict(id=r[1],kind=r[2],lang=r[3],sub=r[4]))

PH={"","orig","auto","und"}
plan=[]; bail=[]
for wid,w in sorted(W.items(), key=lambda kv: kv[1]["title"]):
    trs=TR[wid]
    real=sorted({t["lang"] for t in trs if t["lang"] and t["lang"].lower() not in PH})
    if not trs:
        # 无语言轨: 第一半在 user_works.language(伪轨 lang = String(w.language||"orig"))
        wl=(w["language"] or "").strip()
        if wl.lower() in PH:
            bail.append((wid,w["title"],f"无语言轨且作品行 language='{wl}' 也是占位符 —— 走 w2273 那条, 不在这批")); continue
        new=wl
    else:
        if len(real)!=1:
            bail.append((wid,w["title"],f"轨的真语言码不是恰好一种: {real or '(无)'} —— 不碰")); continue
        new=real[0]
        ph=[t for t in trs if (t["lang"] or "").lower() in PH]
        if ph:
            bail.append((wid,w["title"],f"还有占位符轨 {[t['lang']+'/'+t['voice'] for t in ph]} —— 这是另一类, 先别混")); continue
    # 歌词证据: 作品歌词 + 轨歌词都要指向 new 的文字族
    ev={}
    top,_,dist=detect_major(w["lyrics"]); ev["work_lyrics"]=dict(top=top,dist=dist)
    if top and fam(top)!=fam(new):
        bail.append((wid,w["title"],f"作品歌词字形 {top}({fam(top)}) 与目标语言 {new}({fam(new)}) 不同族 —— 不猜")); continue
    # 这首作品能被读到的全部字幕文件
    urls=[]
    for kind,u in [("作品级take1",w["take1"]),("作品级take2",w["take2"])]:
        if u: urls.append((kind,u))
    for t in trs:
        if t["sub"]: urls.append((f"轨{t['lang']}/{t['voice']}.subtitle_url",t["sub"]))
    for v in VR[wid]:
        if v["sub"]: urls.append((f"版本行{v['id']}({v['kind']})",v["sub"]))
    seen=set(); docs=[]; bad=None
    for kind,u in urls:
        if u in seen: continue
        seen.add(u)
        try: doc=json.loads(fetch(u).decode())
        except Exception as e: bad=f"{kind} 取不到: {type(e).__name__}"; break
        ents=doc.get("languages") or []
        tags=[e.get("lang") for e in ents]
        if tags==[new]: continue                    # 已经对了
        # 文件里已经有目标语言那一条 → 这一份【没坏】, 不动它。
        # 常见情形: ♪2 快照里既有新写的真语言码, 又留着 ♪1 那条 orig 残项。
        # 残项不碍事(没有任何一方要 orig), 而把它也改成 new 会变成同一文件两条同名语言。
        if new in tags: ev[kind]=dict(tags=tags,note="已含目标语言, 不动"); continue
        if len(tags)!=1: bad=f"{kind} 里有 {tags} 多种语言且不含 {new} —— 不猜改哪一条"; break
        if (tags[0] or "").lower() not in PH: bad=f"{kind} 标的是真语言码 {tags[0]} 而非占位符 —— 这是另一类"; break
        body="\n".join(((ln.get("text") or "").strip()) for s in (ents[0].get("sections") or [])
                        for ln in (s.get("lines") or []) if (ln.get("text") or "").strip() not in ("","[Music...]"))
        bt,bn,bd=detect_major(body)
        if not bt or bn<6: bad=f"{kind} 正文判得出的行太少({bn}行) —— 证据不足"; break
        if fam(bt)!=fam(new): bad=f"{kind} 正文字形 {bt}({fam(bt)}) 与目标语言 {new}({fam(new)}) 不同族"; break
        docs.append([kind,None,u]); ev[kind]=dict(tag=tags[0],body_top=bt,judged=bn,dist=bd)
    if bad: bail.append((wid,w["title"],bad)); continue
    if not docs: bail.append((wid,w["title"],"没有需要改的字幕文件(都已经对了)")); continue
    plan.append(dict(id=wid,title=w["title"],lang="orig",new=new,
                     track_langs=[t["lang"] for t in trs],
                     work_language=w["language"],civ=w["civ"],evidence=ev,docs=docs))
json.dump(plan,open(OUT,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(f"计划 {len(plan)} 条 → {OUT}   bail {len(bail)} 条", file=sys.stderr)
for b in bail: print("   BAIL", b[0][:8], b[1][:28], "::", b[2], file=sys.stderr)
for p in plan:
    print(f"   {p['id'][:8]} {p['title'][:30]:<30} orig→{p['new']}  轨={p['track_langs']}  文件 {len(p['docs'])} 份", file=sys.stderr)
