#!/usr/bin/env python3
"""W2156 · 认领归属(零 API): ffprobe 量当前共用音频的真实时长,
再与每个成员【自己字幕的结束时间】比对。字幕是当年对着各自音频做的 ——
谁的结束时间对得上现在这份音频, 谁的音频就是活下来的那一份。"""
import json, os, re, subprocess
env={**os.environ,"PGPASSWORD":"Au#20016"}
def psql(q):
    r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-F","@|@","-c",q],
                     capture_output=True,text=True,env=env)
    return [l for l in r.stdout.strip().split("\n") if l.strip()]
def ffdur(url):
    r=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                      "-of","default=noprint_wrappers=1:nokey=1",url],capture_output=True,text=True,timeout=180)
    try: return round(float(r.stdout.strip()),1)
    except Exception: return None
def subinfo(url):
    if not url: return (None,None,0,"")
    k=url.split("cdn.cssstudio.app/",1)[-1]
    r=subprocess.run("rclone cat 'r2:cssos-artifacts/%s' 2>/dev/null | head -c 900000"%k,
                     shell=True,capture_output=True,text=True)
    try: d=json.loads(r.stdout)
    except Exception: return (None,None,0,"")
    end=0; n=0; txt=""
    an=None
    for L in d.get("languages") or []:
        an = an or L.get("analyzed_at")
        for s in (L.get("sections") or []):
            for ln in (s.get("lines") or []):
                n+=1
                e=ln.get("t_end") or ln.get("t_start") or 0
                end=max(end,e)
                if len(txt)<400: txt+=str(ln.get("text") or "")+" "
    return (round(end/1000.0,1), an, n, txt)
def norm(s): return re.sub(r"[^\w一-鿿぀-ヿ]+","",s).lower()
def overlap(a,b):
    a,b=norm(a),norm(b)
    if not a or not b: return 0.0
    step=max(1,len(b)//250); g={b[i:i+6] for i in range(0,max(1,len(b)-6),step)}
    return sum(1 for x in g if x in a)/max(1,len(g))

GROUPS=["d-3f6d8baaa555320058b33858.mp3","d-79d3d5ebf4ac84d000c1892c.mp3",
        "d-a04ebb58ce54b1b67699da3a.mp3","5285b72d048a.a1.m4a","jerusalem_en_hillsong.mp3"]
for suf in GROUPS:
    rows=psql(f"""SELECT w.id, replace(left(w.title,26),'@|@','/'), w.preview_audio_url,
                         coalesce(w.subtitle_take1_json_url,''),
                         replace(replace(coalesce(w.lyrics_preview,''),chr(10),' '),'@|@','/')
                    FROM user_works w
                   WHERE w.preview_audio_url LIKE '%{suf}' AND w.status IN ('ready','published')
                   ORDER BY w.created_at""")
    if not rows: continue
    url=rows[0].split("@|@")[2]
    dur=ffdur(url)
    print("══ 音频 …%s   ffprobe 实测 %s 秒" % (suf[-30:], dur))
    for line in rows:
        p=line.split("@|@")
        if len(p)<5: continue
        wid,title,_,sub,lyr=p
        end,an,n,txt=subinfo(sub)
        ov=overlap(txt,lyr)
        gap = None if (end is None or dur is None) else round(abs(end-dur),1)
        mark = "…" if gap is None else ("✅对得上" if gap<=6 else "❌差 %ss" % gap)
        print("   %s %-26s 字幕结束 %-7s %s  转写↔自己歌词重合 %3.0f%%  (分析于 %s, %s行)"
              % (wid[:8], title, end, mark, ov*100, (an or "?")[:10], n))
    print()
