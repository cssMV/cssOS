import json, os, re, subprocess
env={**os.environ,"PGPASSWORD":"Au#20016"}
r=subprocess.run(["psql","-h","127.0.0.1","-U","cssstudio","-d","cssstudio","-At","-c",
   "SELECT lyrics_preview FROM user_works WHERE left(id::text,8)='5e77e03a'"],
   capture_output=True,text=True,env=env)
lyr=r.stdout.rstrip("\n")
r2=subprocess.run("rclone cat 'r2:cssos-artifacts/works/5e77e03a-dbe1-4281-82ee-9589c6a8dbb1/subtitle-take1.json'",
                  shell=True,capture_output=True,text=True)
d=json.loads(r2.stdout)
lines=[]
for L in d.get("languages") or []:
    for s in (L.get("sections") or []):
        for ln in (s.get("lines") or []):
            t=str(ln.get("text") or "")
            if t and not t.startswith("[Music"): lines.append(t)
joined="\n".join(lines)
norm=lambda s: re.sub(r"\s+","",s)
print("作品 lyrics_preview 长度 :", len(lyr))
print("字幕 %d 行拼起来长度      : %d" % (len(lines), len(joined)))
print("去空白后【完全相等】      :", norm(lyr)==norm(joined))
if norm(lyr)!=norm(joined):
    a,b=norm(lyr),norm(joined)
    i=next((i for i in range(min(len(a),len(b))) if a[i]!=b[i]), min(len(a),len(b)))
    print("  首个差异位置 %d: 歌词…%s  / 字幕…%s" % (i, a[max(0,i-24):i+24], b[max(0,i-24):i+24]))
print()
print("断行特征(ASR 的切法会断在句中):")
for t in lines[7:11]: print("   |", t)
