#!/usr/bin/env python3
"""CSSOS_WAVE_2077 — 长镜头【末帧接龙】可行性测试。在 api-vm 上跑。

问题: 引擎单次只出 4/6/8 秒, 而《时间帝国》开场就要 90 秒不切。
方案: 第 N 段的【最后一帧】作为第 N+1 段的 image_url, 让它接着往前推。

用《时间帝国》第 1 场的真实内容测(书店推轨) —— 万一成立, 这段素材直接能用。

要回答三个问题, 缺一不可:
  ① 运动会不会延续(还是每段都从静止重新起步)
  ② 接缝处有没有可见跳变
  ③ 三段之后场景会不会漂移(颜色/几何/物件变样)
"""
import json, subprocess, time, os, sys

API="http://127.0.0.1:3000/api/admin/mv-shot"
MODEL=os.environ.get("LT_MODEL","bytedance/seedance-1.5-pro")
W=os.environ.get("LT_WORK","/srv/cssos/tmp/longtake"); os.makedirs(W, exist_ok=True)
TOK=subprocess.run(["bash","-c","grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                   capture_output=True,text=True).stdout.strip()

BASE=("Interior of an old second-hand bookshop at dusk, warm tungsten light, dust in the air, "
      "floor-to-ceiling wooden shelves packed with worn paperbacks, narrow aisle. "
      "SLOW STEADY FORWARD DOLLY at chest height, constant speed, no cuts, no camera shake. "
      "This place is UNINHABITED — no people anywhere. "
      "Shot on anamorphic lenses, cinematic ultrawide 21:9, natural light, film grain, no text.")

SEGS=[
 "The camera glides forward down the aisle; shelves slide past on both sides.",
 "The camera continues forward at the same steady speed; the aisle runs on, more shelves sliding past.",
 "The camera continues forward at the same steady speed; a small reading lamp glows on a shelf ahead to the right.",
 "The camera continues forward at the same steady speed, passing the lamp; the aisle opens into a slightly wider bay.",
 "The camera continues forward at the same steady speed toward a low wooden table at the end of the bay.",
 "The camera continues forward and settles slowly onto a single worn paperback lying face-up on that table.",
]

def shoot(tag, prompt, img=None):
    body={"shot":tag,"project":"longtake","model":MODEL,"duration_secs":6,"prompt":prompt}
    if img: body["image_url"]=img
    for a in range(3):
        r=subprocess.run(["curl","-s","-m","900","-X","POST",API,"-H",f"x-admin-token: {TOK}",
            "-H","content-type: application/json","--data-binary",json.dumps(body)],capture_output=True,text=True)
        try: j=json.loads(r.stdout)
        except Exception: j={"ok":False,"raw":r.stdout[:150]}
        if j.get("ok") and j.get("video"): return j["video"]
        print(f"    重试 {a+1}: {str(j)[:120]}", flush=True); time.sleep(20*(a+1))
    return None

def lastframe(url, out):
    # 取【最后一帧】: 先测时长, 再定位到 末尾前 0.05s
    d=subprocess.run(["bash","-c",
        f"ffmpeg -i '{url}' -f null - 2>&1 | grep -oE 'time=[0-9:.]+' | tail -1 | cut -d= -f2"],
        capture_output=True,text=True).stdout.strip()
    h,m,s=d.split(":"); sec=int(h)*3600+int(m)*60+float(s)
    subprocess.run(["ffmpeg","-y","-v","error","-ss",f"{max(0,sec-0.08):.2f}","-i",url,
                    "-frames:v","1","-q:v","2",out],capture_output=True)
    return os.path.exists(out), sec

urls=[]; prev_img=None
SEGS=SEGS[:int(os.environ.get("LT_N","3"))]
for i,seg in enumerate(SEGS,1):
    print(f"[{i}/3] 生成…", flush=True)
    u=shoot(f"lt{i}", BASE+" "+seg, prev_img)
    if not u: print(f"  ❌ 第 {i} 段失败, 中止"); sys.exit(1)
    urls.append(u); print(f"  ✅ {u}", flush=True)
    if i < len(SEGS):
        f=f"{W}/last{i}.jpg"
        ok,sec=lastframe(u,f)
        if not ok: print("  ❌ 抽末帧失败"); sys.exit(1)
        # 末帧要能被引擎取到 → 传上 R2
        key=f"artifacts/longtake/last{i}-{int(time.time())}.jpg"
        subprocess.run(["rclone","copyto",f,f"r2:cssos-artifacts/{key}"],capture_output=True)
        prev_img=f"https://cdn.cssstudio.app/{key}"
        print(f"  末帧({sec:.2f}s处) → {prev_img}", flush=True)

# 拼接
lst=f"{W}/list.txt"
with open(lst,"w") as fh:
    for i,u in enumerate(urls,1):
        p=f"{W}/seg{i}.mp4"
        subprocess.run(["curl","-s","-o",p,u],capture_output=True)
        fh.write(f"file '{p}'\n")
out=f"{W}/chained.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy",out],capture_output=True)
print(f"\n拼接完成: {out}")
subprocess.run(["bash","-c",f"ffprobe -v error -show_entries format=duration -of csv=p=0 {out}"])
# 抽接缝前后帧供人眼比对
for i,t in enumerate([5.9,6.1,11.9,12.1],1):
    subprocess.run(["ffmpeg","-y","-v","error","-ss",str(t),"-i",out,"-frames:v","1",
                    "-vf","scale=760:-1",f"{W}/seam{i}.jpg"],capture_output=True)
print("接缝帧: seam1(5.9s) seam2(6.1s) seam3(11.9s) seam4(12.1s)")
json.dump({"urls":urls,"chained":out}, open(f"{W}/result.json","w"))
