#!/usr/bin/env python3
"""CSSOS_WAVE_2066 — 《Popol Wuj · 玛雅三部曲》复验器。在 api-vm 上跑。

判据按【本部硬约束】重写, 不照抄鲁米那套(记忆规矩: 判据跟着本部约束走):
  · 人列=无 → 画面里必须 0 人
  · 人列=人 → 恰好 1 位女子, 且头/脸/颈/肩/双臂/双手/双脚完整相连
  · 人列=二 → 恰好 2 人
  · 无现代物
  · **文明必须是玛雅**, 不能串成阿兹特克/印加/埃及(这是本题材最容易犯的错)

提问一律【正面中立】: 让模型"数"和"认", 不让它判"有没有违规" ——
问违规会讨好式地答"无违规"(W1992 的教训)。

先 calibrate 再跑全量; 汇总必须打印【清单 N / 实际 M】, 对不上要看得见。
"""
import base64, json, os, subprocess, sys, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor

SHOTLIST="/tmp/maya-shotlist.json"; PROGRESS="/srv/cssos/tmp/maya-shoot-progress.json"
OUT="/srv/cssos/tmp/maya-audit.json"; WORK="/srv/cssos/tmp/maya-frames"
EP="https://api.kie.ai/gemini-3.1-pro/v1/chat/completions"; MODEL="gemini-3-pro"
K=subprocess.run(["bash","-c","sudo grep -E '^KIE_API_KEY=' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                 capture_output=True,text=True).stdout.strip()
os.makedirs(WORK,exist_ok=True)

Q=("Look at this frame from a film set in the pre-Columbian Maya world (Guatemala/Yucatan). "
   "Answer with ONE json object and nothing else.\n"
   "1. Count every human being visible (whole or partial).\n"
   "2. If exactly one person is visible, is that person a woman? true/false. Else false.\n"
   "3. For every visible person, are head, face, neck, shoulders, both arms, both hands and both feet "
   "either fully visible-and-connected OR cleanly outside the frame (no severed or floating limbs)? true/false.\n"
   "4. Count objects that could not exist before 1500 AD (wires, concrete, cars, plastic, electric light, "
   "modern clothing, glass windows).\n"
   "5. Which ancient culture do the architecture, dress and ornament look like? "
   "one of: maya | aztec | inca | egyptian | southeast_asian | other | none_visible\n"
   'Reply exactly: {"humans":<int>,"is_woman":<bool>,"anatomy_ok":<bool>,"modern":<int>,"culture":"<string>"}')

def ask(jpg):
    b=base64.b64encode(open(jpg,"rb").read()).decode()
    body={"model":MODEL,"messages":[{"role":"user","content":[
        {"type":"text","text":Q},
        {"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+b}}]}],"max_tokens":200}
    for _ in range(3):
        try:
            r=urllib.request.Request(EP,data=json.dumps(body).encode(),
                headers={"Authorization":"Bearer "+K,"Content-Type":"application/json"})
            t=urllib.request.urlopen(r,timeout=120).read().decode()
            c=json.loads(t)["choices"][0]["message"]["content"]
            i=c.find("{"); j=c.rfind("}")
            return json.loads(c[i:j+1])
        except Exception as e:
            err=str(e)[:90]
    return {"error":err}

def frame(url,label):
    f=f"{WORK}/{label}.jpg"
    if not os.path.exists(f):
        subprocess.run(["ffmpeg","-y","-v","error","-ss","2","-i",url,"-vf","scale=760:-1","-frames:v","1",f],
                       capture_output=True)
    return f if os.path.exists(f) else None

def calibrate():
    """在已知答案上标定: 三张锚图应当 0 人且 culture=maya; 一张女主角试拍应当 1 人女性。"""
    known=[("plate-p1","https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-b4b1b37ac89fe9be.png",0),
           ("plate-p2","https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-0e61ef08e5dc8dac.png",0),
           ("plate-p3","https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-09763999e5965e88.png",0),
           ("ab-woman","https://cdn.cssstudio.app/artifacts/mv-shots/maya-ab/shot-ab-seedance--92411583ce03aac3.mp4",1)]
    print("=== 校准(已知答案) ===")
    ok=0
    for lbl,u,expect in known:
        f=f"{WORK}/{lbl}.jpg"
        if u.endswith(".png"):
            subprocess.run(["bash","-c",f"curl -s -o /tmp/{lbl}.png '{u}' && ffmpeg -y -v error -i /tmp/{lbl}.png -vf scale=760:-1 {f}"],capture_output=True)
        else: frame(u,lbl)
        r=ask(f); got=r.get("humans"); hit = (got==expect)
        ok+=hit
        print(f"  {lbl:10s} 期望{expect}人 实测{got}人 {'✅' if hit else '❌'} culture={r.get('culture')} {r.get('error','')}")
    print(f"  校准命中 {ok}/4 —— {'判据可用' if ok>=3 else '⚠️ 判据不可靠, 不要据此下结论'}")
    return ok>=3

def main():
    if not calibrate() and "--force" not in sys.argv:
        print("校准未过, 中止(加 --force 可强跑)"); return
    sl=json.load(open(SHOTLIST)); prog=json.load(open(PROGRESS))
    rows=[]
    for p in ("p1","p2","p3"):
        for s in sl[p]:
            num,who=s[1],s[6]; r=prog.get(f"{p}#{num}")
            if r and r.get("ok"): rows.append((p,num,who,r["url"]))
    print(f"\n=== 全量复验: 清单 162 / 拍成 {len(rows)} ===")
    res={}; lock=__import__("threading").Lock()
    def one(t):
        p,num,who,url=t; lbl=f"{p}-{num}"
        f=frame(url,lbl)
        r=ask(f) if f else {"error":"no-frame"}
        r["who"]=who
        with lock:
            res[lbl]=r
            if len(res)%20==0: print(f"  …{len(res)}/{len(rows)}",flush=True)
    with ThreadPoolExecutor(max_workers=4) as ex: list(ex.map(one,rows))
    json.dump(res,open(OUT,"w"),ensure_ascii=False,indent=1)

    bad=collections.defaultdict(list); errs=[]
    for lbl,r in sorted(res.items()):
        if r.get("error"): errs.append(lbl); continue
        h=r.get("humans",0); who=r["who"]
        if who=="无" and h!=0: bad["无人镜却有人"].append(f"{lbl}({h}人)")
        if who=="人" and h!=1: bad["单人镜人数不对"].append(f"{lbl}({h}人)")
        if who=="人" and h==1 and r.get("is_woman") is False: bad["单人镜不是女性"].append(lbl)
        if who=="二" and h!=2: bad["双人镜人数不对"].append(f"{lbl}({h}人)")
        if h>0 and r.get("anatomy_ok") is False: bad["肢体不完整"].append(lbl)
        if r.get("modern",0)>0: bad["现代物"].append(f"{lbl}({r['modern']})")
        c=str(r.get("culture","")).lower()
        if c not in ("maya","none_visible",""): bad["文明串了"].append(f"{lbl}({c})")
    print(f"\n=== 复验汇总: 清单 162 / 拍成 {len(rows)} / 实际判读 {len(res)-len(errs)} / 判读失败 {len(errs)} ===")
    if len(res) != len(rows): print(f"⚠️ 判读数 {len(res)} ≠ 拍成数 {len(rows)}, 有漏")
    tot=0
    for k,v in bad.items():
        tot+=len(v); print(f"  {k}: {len(v)} —— {', '.join(v[:12])}{' …' if len(v)>12 else ''}")
    if not bad: print("  无违规")
    print(f"  违规合计 {tot} / {len(res)-len(errs)} 镜")
    if errs: print(f"  判读失败: {', '.join(errs[:10])}")

main()
