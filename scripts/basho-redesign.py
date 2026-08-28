#!/usr/bin/env python3
# CSSOS_WAVE_2013 — 芭蕉两处【分镜设计错误】的重拍(不是引擎的锅, 是我写错了)。
#
# Jing:「只显示脚趾头在鞋里, 却不显示整条腿, 只有一只手, 没有整个人, 很诡异, 像恐怖片。」
#      「总是上台阶, 到了台阶顶部又重新上台阶, 就好像这台阶永远上不到顶。」
#
# ① p1#1 我写的是「只有手与绳, 不见人」—— 静帧里像刻意留白, 动起来就是【一只悬空的手】,
#    再加上鞋里露出脚趾, 确实是恐怖片语法。改成: 看得见人的下半身与坐姿, 手是他的手。
# ② 第二部一幕头 8 镜里有 5 镜是台阶(#1#2#6#7#8), 而且都是【同一段台阶的不同角度】,
#    彼此没有"走到哪了"的信息 -> 连起来就是永远上不到顶。
#    改法: 每一镜必须带【进度信息】—— 起点/回望来路/俯看他在下方/接近顶部,
#    并且给每镜一个独一无二的地貌特征(桥/转折/苔石/岩壁), 让人看得出这是不同的一段。
import json, subprocess, re

TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True,text=True).stdout.split("=",1)[1].strip().strip('"')
SCENE = json.load(open("/tmp/basho_scene.json"))
PLATE = json.load(open("/tmp/basho_plates.json"))
STYLE = open("/tmp/basho_style.txt").read()
ONE = (" EXACTLY ONE person, an adult male travelling poet in a woven sedge hat and dark travel robe, "
       "seen from BEHIND or in profile; his face is never visible. NEVER two or more people.")
NONE = (" This place is completely deserted — NOT A SINGLE PERSON anywhere in the frame, near or far, "
        "no silhouette, no figure on any step or horizon.")

R = {
 # ① 悬空的手 -> 看得见完整的人
 "p1#1": (8, PLATE["1"], SCENE["1"],
   "Opening from black. A travelling poet SITS on a low rock at the edge of the summer grass, seen "
   "from BEHIND AND SLIGHTLY TO THE SIDE so that his whole seated body is visible — back, shoulders, "
   "folded legs, the hem of his robe, and both bare feet. He leans forward and reties the cord of one "
   "straw sandal. The hand belongs visibly to him: arm, sleeve, shoulder and body all connected in "
   "frame. Calm and ordinary, not eerie." + ONE),
 # ② 台阶: 每镜给一个不同的地貌特征 + 明确的进度信息
 "p2#1": (8, PLATE["2"], SCENE["2"],
   "THE VERY BOTTOM of the mountain-temple stairway. A weathered wooden gate frames the FIRST few "
   "stone steps; beyond the gate the flight rises and disappears among cedars. We are clearly at the "
   "START of the climb — flat ground and a village path behind, the mountain ahead." + NONE),
 "p2#2": (8, PLATE["2"], SCENE["2"],
   "LOOKING BACK DOWN the stairway from partway up: the steps fall away steeply below and the valley "
   "floor with its river is already small and far beneath. We can see HOW FAR the climb has come. "
   "A wooden handrail post and a stone lantern mark this particular landing." + NONE),
 "p2#6": (8, PLATE["2"], SCENE["2"],
   "A NARROW passage where the stairway squeezes between two huge mossy boulders, wide enough for one "
   "person. The steps here are buried under a thick layer of fallen cedar needles. This section is "
   "unmistakably different from the open flights below — dark, damp and enclosed." + NONE),
 "p2#7": (8, PLATE["2"], SCENE["2"],
   "SEEN FROM HIGH ABOVE, looking down: the tiny figure of the traveller is far below on the stairway, "
   "occupying a twelfth of the frame, with many flights of steps still above him. The camera is near "
   "the top of the cliff; he is near the bottom." + ONE),
 "p2#8": (8, PLATE["2"], SCENE["2"],
   "EXTREME CLOSE-UP of a single stone step, filling the frame: its centre worn into a shallow hollow "
   "by centuries of feet, wet, with moss in the crack. No other steps visible, no receding flight — "
   "just this one stone." + NONE),
 "p2#17": (8, PLATE["2"], SCENE["2"],
   "NEAR THE TOP of the climb. The stairway finally opens out; the great red rock face and the small "
   "temple hall are directly above and close now. The traveller has stopped on the last stretch of "
   "steps, seen from behind, head tilted back to look up at the cliff. The ascent is clearly ending." + ONE),
 "p2#46": (8, PLATE["2"], SCENE["2"],
   "GOING DOWN. Seen from below, looking up the stairway at the traveller descending toward the camera, "
   "still small and high on the steps. Behind and above him the cliff and temple recede. The direction "
   "of travel is unmistakably downward." + ONE),
}

out={}
for lbl,(dur,plate,scene,body) in R.items():
    pk,num=lbl.split("#")
    b={"shot":f"bs{pk[1]}{num}rd","project":"basho","model":"bytedance/seedance-1.5-pro",
       "duration_secs":dur,"image_url":plate,"prompt":scene+body+STYLE}
    ok=False
    for _ in range(3):
        r=subprocess.run(["curl","-s","-m","900","-X","POST","http://127.0.0.1:3000/api/admin/mv-shot",
            "-H",f"x-admin-token: {TOK}","-H","content-type: application/json","--data-binary",json.dumps(b)],
            capture_output=True,text=True)
        try: j=json.loads(r.stdout)
        except Exception: j={}
        if j.get("ok") and j.get("video"): out[lbl]=j["video"]; ok=True; break
    print(("✅ " if ok else "❌ ")+lbl, flush=True)
json.dump(out,open("/srv/cssos/tmp/basho-redesign.json","w"))
print(f"重拍 {len(out)}/{len(R)}")
