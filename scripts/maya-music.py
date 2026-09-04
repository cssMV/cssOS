#!/usr/bin/env python3
"""CSSOS_WAVE_2069 — 玛雅三部曲出音乐(3 首)。在 api-vm 上跑。
歌词从 markdown 逐部切出; 曲风必须英文(Suno 只认英文, 京典模版第 8 条)。
"""
import json, re, subprocess, sys, time

MD="/tmp/maya-lyrics.md"
API="http://127.0.0.1:3000/api/admin/mv-song"
STYLE=("ancient maya ritual, clay ocarina and bone flute, turtle shell drum, tunkul log drum, "
       "conch shell horn, rattle seeds, pentatonic, mesoamerican jungle, female vocal, "
       "earthy and resonant, ceremonial call and response, wide reverb")
PARTS=[("p1","Xkik'","第一部"),("p2","Xib'alb'a","第二部"),("p3","Ixim","第三部")]

def cut(md, tag):
    # 取「# 第N部 …」到下一个「# 」之间, 只保留 [小节] 与歌词行
    m=re.search(rf"^# {tag} ·(.*?)(?=^# |\Z)", md, re.S|re.M)
    if not m: sys.exit(f"没切到 {tag}")
    body=m.group(1)
    out=[]
    for ln in body.splitlines():
        s=ln.strip()
        if not s or s.startswith(("**","|","---",">")): continue
        out.append(s)
    return "\n".join(out).strip()

def main():
    md=open(MD,encoding="utf-8").read()
    tok=subprocess.run(["bash","-c","grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                       capture_output=True,text=True).stdout.strip()
    res={}
    for pk,name,tag in PARTS:
        ly=cut(md,tag)
        n=len([l for l in ly.splitlines() if not l.startswith("[")])
        print(f"{pk} 《{name}》 歌词 {n} 行, {ly.count('[')} 节", flush=True)
        body={"lyrics":ly,"title":f"Popol Wuj · {name}","style":STYLE,
              "language":"quc","project":"maya","slug":f"maya-{pk}"}
        for a in range(3):
            r=subprocess.run(["curl","-s","-m","900","-X","POST",API,"-H",f"x-admin-token: {tok}",
                "-H","content-type: application/json","--data-binary",json.dumps(body)],
                capture_output=True,text=True)
            try: j=json.loads(r.stdout)
            except Exception: j={"ok":False,"raw":r.stdout[:200]}
            if j.get("ok"):
                res[pk]=j; print(f"  ✅ {str(j.get('audio') or j.get('audio_url') or '')[:88]}", flush=True); break
            print(f"  重试{a+1}: {str(j)[:140]}", flush=True); time.sleep(25*(a+1))
        else:
            res[pk]={"ok":False}
    json.dump(res, open("/srv/cssos/tmp/maya-music.json","w"), ensure_ascii=False, indent=1)
    ok=sum(1 for v in res.values() if v.get("ok"))
    print(f"=== 出歌 {ok}/3 ===")
main()
