#!/usr/bin/env python3
"""CSSOS_WAVE_2067 — 玛雅三部曲定点重拍(35 镜)。在 api-vm 上跑。

**按每一镜的失败原因加针对性约束**, 不是笼统重发一遍 ——
笼统重发只会再抽一次同样的签(W2003 的教训)。约束一律正面表述。
"""
import json, subprocess, time, sys
from concurrent.futures import ThreadPoolExecutor

SL="/tmp/maya-shotlist.json"; NEED="/tmp/maya-reshoot.json"
PROG="/srv/cssos/tmp/maya-shoot-progress.json"; API="http://127.0.0.1:3000/api/admin/mv-shot"
MODEL="bytedance/seedance-1.5-pro"
PLATE={"p1":"https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-b4b1b37ac89fe9be.png",
       "p2":"https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-0e61ef08e5dc8dac.png",
       "p3":"https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-09763999e5965e88.png"}
SCENE={
 "p1":("The Maya underworld Xibalba and the world just above it, pre-Columbian Guatemala, mythic. "
       "Deep-green gloom, bone-white leafless trees on wet black earth, a black river, drifting fireflies. "),
 "p2":("A Maya stone ballcourt and the nine houses of Xibalba at night, pre-Columbian Guatemala, mythic. "
       "Near-black shadow with orange torchlight and lime-white stone; a carved stone ring high on each sloped wall. "),
 "p3":("The Guatemalan highland at dawn after rain, pre-Columbian Maya, mythic. Gold-green terraced maize, "
       "black volcanic soil, a round jade-green cenote, a limestone step-pyramid on the ridge. "),
}
PERSON={
 "无":" This place is UNINHABITED: it is deserted for miles and the horizon holds no figure of any kind.",
 "人":(" Exactly one young Maya woman is present and she is the only person here: long black hair, deep-red woven "
       "huipil, jade beads. Her head, face, neck, shoulders, both arms, both hands with five fingers each and both "
       "feet are complete and joined to one body."),
 "二":(" Exactly two young Maya men are present and they are the only people here. Each of the two has his own head, "
       "face, neck, shoulders, both arms, both hands with five fingers each and both feet, complete and joined."),
 "多":(" Several Maya people are present. EVERY person shown has a head, face, neck, shoulders, both arms, both hands "
       "with five fingers each and both feet, complete and joined to one body; no severed or floating limbs."),
}
# 按失败原因追加的正面约束
FIX={
 "文明":(" ARCHITECTURE IS CLASSIC MAYA ONLY: limestone corbel-arch doorways, stepped pyramids with a tall roof comb, "
         "stucco masks of long-nosed deities, carved stelae with Maya glyph blocks, thatch-and-pole houses — the look "
         "of Tikal, Palenque and Yucatan."),
 "现代":(" EVERY light in this world comes only from open flame, moonlight, sunlight or living fireflies; every surface "
         "is stone, wood, clay, cotton, jade, feather or bone."),
 "肢体":(" Every living body in frame is anatomically whole: each person or animal keeps one head, one neck, the correct "
         "number of limbs, and each hand has five fingers, all joined to that one body."),
 "无人":(" NOBODY IS HERE. The land is empty of people to the horizon; only landscape, stone, water, plants and animals."),
}
def main():
    sl=json.load(open(SL)); need=json.load(open(NEED)); prog=json.load(open(PROG))
    tok=subprocess.run(["bash","-c","grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                       capture_output=True,text=True).stdout.strip()
    S={f"{p}-{s[1]}":(p,s[1],s[4],s[5],s[6]) for p in sl for s in sl[p]}
    jobs=[(l,need[l]) for l in need if l in S]
    print(f"重拍 {len(jobs)} 镜", flush=True)
    lock=__import__("threading").Lock(); done=[0]
    def run(t):
        lbl,why=t; p,num,dur,desc,who=S[lbl]
        extra=""
        if "文明" in why: extra+=FIX["文明"]
        if "现代物" in why: extra+=FIX["现代"]
        if "肢体" in why: extra+=FIX["肢体"]
        if "无人镜有" in why: extra+=FIX["无人"]
        prompt=SCENE[p]+desc.replace("**","")+PERSON.get(who,PERSON["无"])+extra+ \
               " Shot on anamorphic lenses, cinematic ultrawide 21:9, natural light only, rich film grain, no text."
        body={"shot":f"my{p[-1]}{num}r","project":"maya","model":MODEL,"duration_secs":int(dur),
              "image_url":PLATE[p],"prompt":prompt}
        j={}
        for a in range(3):
            r=subprocess.run(["curl","-s","-m","900","-X","POST",API,"-H",f"x-admin-token: {tok}",
                "-H","content-type: application/json","--data-binary",json.dumps(body)],capture_output=True,text=True)
            try: j=json.loads(r.stdout)
            except Exception: j={"ok":False,"raw":r.stdout[:150]}
            if j.get("ok") and j.get("video"):
                with lock:
                    prog[f"{p}#{num}"]={"ok":True,"url":j["video"],"dur":int(dur),"reshot":why}
                    json.dump(prog,open(PROG,"w"),ensure_ascii=False); done[0]+=1
                    print(f"[{done[0]}/{len(jobs)}] {lbl} OK   ({why})",flush=True)
                return
            time.sleep(20*(a+1))
        with lock:
            done[0]+=1; print(f"[{done[0]}/{len(jobs)}] {lbl} FAIL {str(j)[:120]}",flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex: list(ex.map(run,jobs))
    print(f"=== 重拍完成 {done[0]}/{len(jobs)} ===")
main()
