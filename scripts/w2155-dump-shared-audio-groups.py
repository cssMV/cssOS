#!/usr/bin/env python3
"""W2155 · 作品级共用音频的 20 组 —— 逐组摊开(只读)。"""
import os, subprocess, collections
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","@|@","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]
rows=psql("""
WITH g AS (SELECT preview_audio_url u FROM user_works
            WHERE coalesce(preview_audio_url,'')<>'' AND status IN ('ready','published')
            GROUP BY 1 HAVING count(*)>1)
SELECT w.preview_audio_url, w.id, replace(left(w.title,30),'@|@','/'), w.status,
       w.created_at::date, coalesce(w.duration_secs,0),
       coalesce(length(w.lyrics_preview),0),
       left(md5(coalesce(w.lyrics_preview,'')),6),
       replace(replace(left(coalesce(w.lyrics_preview,''),46),chr(10),' '),'@|@','/'),
       case when coalesce(w.subtitle_take1_json_url,'')='' then '' else 'SUB' end
  FROM user_works w JOIN g ON g.u=w.preview_audio_url
 WHERE w.status IN ('ready','published')
 ORDER BY w.preview_audio_url, w.created_at""")
groups=collections.OrderedDict()
for line in rows:
    p=line.split("@|@")
    if len(p)<10: continue
    groups.setdefault(p[0],[]).append(p[1:])
print("作品级共用组数 %d\n" % len(groups))
for i,(u,ms) in enumerate(groups.items(),1):
    print("══ 组%-2d  音频 …%s   成员 %d" % (i, u[-30:], len(ms)))
    langs={m[6] for m in ms}
    for wid,title,st,cre,dur,lyrlen,fp,head,sub in ms:
        print("   %s %-30s %-9s %s %4ss 词%-4s fp=%s %-3s | %s" %
              (wid[:8],title,st,cre,dur,lyrlen,fp,sub,head))
    print("   → 歌词指纹种类 %d %s" % (len(langs), "(全组同词, 大概率是同一首的多次生成)" if len(langs)==1 else "⚠ 组内歌词不同 —— 至少有一个作品的音频不是它自己的"))
