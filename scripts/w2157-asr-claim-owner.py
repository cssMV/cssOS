import os, re, subprocess
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","@|@","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]
def norm(s): return re.sub(r"[^\w一-鿿぀-ヿ]+","",s).lower()
def ov(a,b):
    a,b=norm(a),norm(b)
    if not a or not b: return 0.0
    step=max(1,len(b)//250); g={b[i:i+6] for i in range(0,max(1,len(b)-6),step)}
    return sum(1 for x in g if x in a)/max(1,len(g))
for suf,label in [("5285b72d048a.a1.m4a","组18"),("jerusalem_en_hillsong.mp3","组20")]:
    try: txt=open("/tmp/asr_%s.txt"%suf,encoding="utf-8",errors="replace").read().strip()
    except Exception: print(label,"无转写"); continue
    print("══ %s  转写 %d 字" % (label,len(txt)))
    print("   %s…" % txt[:132].replace("\n"," "))
    rows=psql(f"""SELECT w.id, replace(left(w.title,24),'@|@','/'),
                    replace(replace(coalesce(w.lyrics_preview,''),chr(10),' '),'@|@','/')
                  FROM user_works w WHERE w.preview_audio_url LIKE '%{suf}'
                   AND w.status IN ('ready','published') ORDER BY w.created_at""")
    best=None
    for line in rows:
        p=line.split("@|@")
        if len(p)<3: continue
        wid,title,lyr=p
        o=ov(txt,lyr)
        best=(o,title,wid) if (best is None or o>best[0]) else best
        print("      %s %-24s 与转写重合 %3.0f%%  (歌词 %d 字)" % (wid[:8],title,o*100,len(lyr)))
    if best: print("   → 归属: %s (%s), 重合 %.0f%%" % (best[1],best[2][:8],best[0]*100))
    print()
