#!/usr/bin/env python3
"""CSSOS_WAVE_2078 — 《时间帝国》第 1 场: 90 秒开场长镜头。在 api-vm 上跑。

15 段 × 6 秒, seedance-2 末帧接龙(W2077 实测: 只有 2.0 能真续接)。
**串行, 不能并发** —— 每段要等上一段的末帧。约 45 分钟。

设计: 镜头在旧书店里缓慢穿行, 最后停在一本平装小说上 —— 那本书就是
一百年前那位小说家的警告, 而世界把它读成了科幻。**片名在此压上(后期加, 不生成文字)。**

断点续拍: 每段落盘即写进度, 断了重跑只补没拍的。
"""
import json, subprocess, time, os, sys

API="http://127.0.0.1:3000/api/admin/mv-shot"
MODEL="bytedance/seedance-2"
W="/srv/cssos/tmp/te-scene1"; os.makedirs(W, exist_ok=True)
PROG=f"{W}/progress.json"
TOK=subprocess.run(["bash","-c","grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                   capture_output=True,text=True).stdout.strip()

# 每段都复述的【不变元素】—— W2077 须知③: 不复述, 环境会缓慢漂走
BASE=("Interior of a vast old second-hand bookshop at dusk. Warm tungsten bulbs hang on long cords; "
      "dust drifts in the light. Floor-to-ceiling dark wooden shelves packed with worn cloth and paper books, "
      "narrow aisles, bare wooden floor. SLOW STEADY FORWARD DOLLY at chest height, constant speed, "
      "no cuts, no camera shake, no zoom. This place is UNINHABITED — nobody is here, and no one appears. "
      "Shot on anamorphic lenses, cinematic ultrawide 21:9, natural light only, rich film grain, "
      "no text of any kind, no signage, no lettering.")

SEGS=[
 # 一 · 进入(24s) —— 暖, 亮, 像被欢迎
 "The camera enters the mouth of a lit aisle; shelves begin to slide past on both sides.",
 "The camera glides on at the same steady speed; a hanging bulb passes overhead.",
 "The camera continues at the same steady speed; the aisle runs straight ahead, shelves unbroken.",
 "The camera continues at the same steady speed; a second hanging bulb passes overhead, further apart than the first.",
 # 二 · 深入(24s) —— 越来越暗, 店大得不合常理
 "The camera continues at the same steady speed; the light thins and the shelves rise higher on both sides.",
 "The camera continues at the same steady speed into a dimmer stretch; the far end of the aisle is not visible.",
 "The camera continues at the same steady speed; a cross-aisle opens briefly to the left and closes behind.",
 "The camera continues at the same steady speed; the shop feels far larger inside than it could be outside.",
 # 三 · 窗光(24s) —— 一束光, 灰尘, 呼吸
 "The camera continues at the same steady speed; a shaft of pale daylight falls across the aisle ahead from a high window.",
 "The camera continues at the same steady speed and passes through the shaft of light; dust turns in it.",
 "The camera continues at the same steady speed; beyond the light the shelves are older, the spines more faded.",
 "The camera continues at the same steady speed; the aisle begins to widen into a small reading bay ahead.",
 # 四 · 落点(18s) —— 一张桌, 一本书
 "The camera continues at the same steady speed into the reading bay; a low wooden table stands at the far side.",
 "The camera continues forward, slowing, toward the table; a single worn paperback lies face-up on it.",
 "The camera settles slowly and stops on the paperback lying face-up on the table, its blank cover filling the centre of frame.",
]

def load(): 
    try: return json.load(open(PROG))
    except Exception: return {}
def save(d): json.dump(d, open(PROG,"w"), ensure_ascii=False)

def shoot(tag, prompt, img):
    body={"shot":tag,"project":"te-s1","model":MODEL,"duration_secs":6,"prompt":prompt}
    if img: body["image_url"]=img
    for a in range(3):
        r=subprocess.run(["curl","-s","-m","900","-X","POST",API,"-H",f"x-admin-token: {TOK}",
            "-H","content-type: application/json","--data-binary",json.dumps(body)],capture_output=True,text=True)
        try: j=json.loads(r.stdout)
        except Exception: j={"ok":False,"raw":r.stdout[:150]}
        if j.get("ok") and j.get("video"): return j["video"]
        print(f"    重试 {a+1}: {str(j)[:130]}", flush=True); time.sleep(25*(a+1))
    return None

def lastframe(url, out):
    d=subprocess.run(["bash","-c",
        f"ffmpeg -i '{url}' -f null - 2>&1 | grep -oE 'time=[0-9:.]+' | tail -1 | cut -d= -f2"],
        capture_output=True,text=True).stdout.strip()
    h,m,s=d.split(":"); sec=int(h)*3600+int(m)*60+float(s)
    subprocess.run(["ffmpeg","-y","-v","error","-ss",f"{max(0,sec-0.08):.2f}","-i",url,
                    "-frames:v","1","-q:v","2",out],capture_output=True)
    return os.path.exists(out)

prog=load()
print(f"第 1 场 · 90 秒开场 · 已完成 {len(prog)}/{len(SEGS)} 段", flush=True)
prev=prog.get(f"img{len(prog)}")
for i,seg in enumerate(SEGS,1):
    if f"seg{i}" in prog: continue
    print(f"[{i}/{len(SEGS)}] 生成…", flush=True)
    u=shoot(f"tes1_{i:02d}", BASE+" "+seg, prev)
    if not u:
        print(f"  ❌ 第 {i} 段失败 —— 已保存进度, 重跑本脚本可续。"); sys.exit(1)
    prog[f"seg{i}"]=u; save(prog); print(f"  ✅ {u}", flush=True)
    if i < len(SEGS):
        f=f"{W}/last{i}.jpg"
        if not lastframe(u,f): print("  ❌ 抽末帧失败"); sys.exit(1)
        key=f"artifacts/te-s1/last{i}-{int(time.time())}.jpg"
        subprocess.run(["rclone","copyto",f,f"r2:cssos-artifacts/{key}"],capture_output=True)
        prev=f"https://cdn.cssstudio.app/{key}"
        prog[f"img{i}"]=prev; save(prog)

# 拼接
lst=f"{W}/list.txt"
with open(lst,"w") as fh:
    for i in range(1,len(SEGS)+1):
        p=f"{W}/seg{i}.mp4"
        subprocess.run(["curl","-s","-o",p,prog[f"seg{i}"]],capture_output=True)
        fh.write(f"file '{p}'\n")
out=f"{W}/te-scene1-opening.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy",out],capture_output=True)
dur=subprocess.run(["bash","-c",f"ffprobe -v error -show_entries format=duration -of csv=p=0 {out}"],
                   capture_output=True,text=True).stdout.strip()
print(f"\n=== 完成: {out} · {dur} 秒 ===")
subprocess.run(["rclone","copyto",out,"r2:cssos-artifacts/artifacts/mv/te-scene1-opening.mp4"],capture_output=True)
print("已落 R2: https://cdn.cssstudio.app/artifacts/mv/te-scene1-opening.mp4")
