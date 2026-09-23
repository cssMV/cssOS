import json, os, subprocess
def norm(x):
    v=str(x or "").lower().replace("_","-"); return v.split("-")[0] or v
PLACE={"","orig","auto","und"}
plan=json.load(open("/tmp/w2149/plan.json"))
wids=sorted({p["key"].split("/")[1] for p in plan})
inlist="','".join(wids)
q=("SELECT t.work_id, t.lang, t.voice, coalesce(w.subtitle_take1_json_url,'') "
   "FROM work_language_tracks t JOIN user_works w ON w.id=t.work_id "
   f"WHERE t.work_id IN ('{inlist}') AND t.status='ready' AND coalesce(t.subtitle_url,'')=''")
out=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","|","-c",q],
                   capture_output=True,text=True,env={**os.environ,"PGPASSWORD":"Au#20016"})
okc=bad=skip=0
for line in out.stdout.strip().split("\n"):
    if line.count("|")<3: continue
    wid,lang,voice,wl=line.split("|",3)
    if voice=="pre-epic":
        print("  skip %s %s/pre-epic 按 W2145 设计【不借作品级字幕】" % (wid[:8], lang)); skip+=1; continue
    if not wl: print("  BAD %s %s/%s 作品级也没有字幕" % (wid[:8],lang,voice)); bad+=1; continue
    k=wl.split("cdn.cssstudio.app/",1)[-1]
    r=subprocess.run("rclone cat 'r2:cssos-artifacts/%s'" % k, shell=True, capture_output=True, text=True)
    try: d=json.loads(r.stdout)
    except Exception: print("  BAD %s %s/%s 取不到" % (wid[:8],lang,voice)); bad+=1; continue
    L=d.get("languages") or []
    e=next((x for x in L if str(x.get("lang"))==lang),None) or next((x for x in L if norm(x.get("lang"))==norm(lang)),None)
    if not e and len(L)==1 and str(L[0].get("lang") or "").lower() in PLACE: e=L[0]
    n=sum(len(s.get("lines") or []) for s in (e.get("sections") or [])) if e else 0
    tags=[str(x.get("lang")) for x in L]
    if e and n>0: okc+=1; print("  OK  %s %s/%s → 选中 %s 行%d" % (wid[:8],lang,voice,e.get("lang"),n))
    else: bad+=1; print("  BAD %s %s/%s 选不中, 文件有 %s" % (wid[:8],lang,voice,tags))
print("\n走作品级的: 选得中 %d / 选不中 %d / 按设计跳过 %d" % (okc,bad,skip))
