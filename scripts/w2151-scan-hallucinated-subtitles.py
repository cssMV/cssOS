#!/usr/bin/env python3
"""扫 Whisper 在无人声音频上的经典幻觉字幕(只读)。
判据不靠"行数少", 靠【已知幻觉短语】+ 【行数极少】双证 —— 只凭行数少会误伤短曲。"""
import json, os, re, subprocess
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","|","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]
HALL=re.compile(r"(thank you|thanks for watching|please subscribe|字幕由|subtitles by|"
                r"amara\.org|請不吝點贊|訂閱|转发打赏|MBC ?뉴스|ご視聴ありがとう)", re.I)
rows=psql("SELECT id, replace(left(title,30),'|','/'), status, coalesce(subtitle_take1_json_url,''), "
          "coalesce(length(lyrics_preview),0), replace(coalesce(left(style,34),''),'|','/') "
          "FROM user_works WHERE coalesce(subtitle_take1_json_url,'') <> ''")
print("有字幕指针的作品 %d 个, 逐个看内容…\n" % len(rows))
hits=[]
for line in rows:
    p=line.split("|")
    if len(p)<6: continue
    wid,title,st,url,lyrlen,style=p[0],p[1],p[2],p[3],int(p[4] or 0),p[5]
    k=url.split("cdn.cssstudio.app/",1)[-1]
    r=subprocess.run("rclone cat 'r2:cssos-artifacts/%s' 2>/dev/null | head -c 400000" % k,
                     shell=True,capture_output=True,text=True)
    try: d=json.loads(r.stdout)
    except Exception: continue
    L=d.get("languages") or []
    txt=""; n=0
    for x in L:
        for s in (x.get("sections") or []):
            for ln in (s.get("lines") or []):
                n+=1; txt+=str(ln.get("text") or "")+" "
    body=re.sub(r"\[[^\]]*\]","",txt).strip()
    if n<=6 and HALL.search(body):
        hits.append((wid,title,st,n,style,lyrlen,body[:60]))
print("命中(行数≤6 且含已知幻觉短语) %d 个:" % len(hits))
for wid,title,st,n,style,lyrlen,body in hits:
    print("  %s %-30s [%-9s] 行%-2d 作品歌词%-4d style=%-22s | %s" % (wid[:8],title,st,n,lyrlen,style[:22],body))
