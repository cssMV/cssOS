#!/usr/bin/env python3
"""W2152 · 重算(判据空白不敏感)。凯撒的 lyrics 是 'Thanks\\nfor watching!' —— 
短语中间是换行, 连续短语的正则漏掉了它。字幕正文里同样可能被换行/多空格切断。"""
import json, os, re, subprocess
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","|","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]
HALL=re.compile(r"(thank\s*you|thanks\s*for\s*watching|please\s*subscribe|字幕\s*由|subtitles\s*by|"
                r"amara\.org|請不吝點贊|訂閱|转发打赏|ご視聴\s*ありがとう)", re.I)
def hallu(url):
    if not url: return (False,0,"")
    k=url.split("cdn.cssstudio.app/",1)[-1]
    r=subprocess.run("rclone cat 'r2:cssos-artifacts/%s' 2>/dev/null | head -c 400000"%k,
                     shell=True,capture_output=True,text=True)
    try: d=json.loads(r.stdout)
    except Exception: return (False,0,"")
    txt=""; n=0
    for x in (d.get("languages") or []):
        for s in (x.get("sections") or []):
            for ln in (s.get("lines") or []):
                n+=1; txt+=str(ln.get("text") or "")+" "
    body=re.sub(r"\[[^\]]*\]","",txt).strip()
    return (n<=6 and bool(HALL.search(body)), n, body[:40])

A={}
for line in psql("SELECT id, coalesce(subtitle_take1_json_url,'') FROM user_works WHERE coalesce(subtitle_take1_json_url,'')<>''"):
    wid,url=line.split("|",1)
    hit,n,b=hallu(url)
    if hit: A[wid]=url
B=[]
for line in psql("SELECT id, replace(replace(coalesce(lyrics_preview,''),chr(10),' '),chr(13),' ') "
                 "FROM user_works WHERE coalesce(length(lyrics_preview),0)<=40 AND coalesce(lyrics_preview,'')<>''"):
    wid,lp=line.split("|",1)
    if HALL.search(lp): B.append(wid)
C={}
rel=set(A)|set(B)
for line in psql("SELECT id, work_id, coalesce(subtitle_url,'') FROM work_language_tracks WHERE coalesce(subtitle_url,'')<>''"):
    tid,wid,url=line.split("|",2)
    if wid not in rel: continue
    hit,n,b=hallu(url)
    if hit: C[tid]=(wid,url)
print("A 作品级指针→幻觉 %d" % len(A))
print("B lyrics_preview 是幻觉 %d" % len(B))
print("C 轨级指针→幻觉 %d" % len(C))
print("并集作品 %d" % len(set(A)|set(B)|{v[0] for v in C.values()}))
json.dump({"A":sorted(A),"B":sorted(B),"C":sorted(C)}, open("/tmp/w2152_sets.json","w"))
