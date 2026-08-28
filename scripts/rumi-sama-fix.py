#!/usr/bin/env python3
"""CSSOS_WAVE_2018 — 鲁米「سماع 旋转」段落返修。

Jing 交付前我自己从 CDN 抽帧核对, 抓到第三部高潮整段是坏的:
  · 红袍长发女子在跳(该是白袍男性苦行僧)   p3#19 #21 #29
  · 两个人同时在场                          p3#30
  · 【没有人的袍子自己站着】——白袍/黑袍悬空 p3#7 #8 #13 #16   ← 又是芭蕉那只悬空的手
  · 该有手/该有舞者的镜里空无一人            p3#11 #12 #36 #42
  · 该空无一人的镜里站着人                   p2#7 #17
  · 该白袖的手, 袖子是红的                   p2#1

【根因·一句话】我那条判断「这一镜该不该有人」的正则里没有「帽」「袍」「手」「裙裾」,
于是「帽子稳定不动 —— 头是轴」被判成【无人镜】, 发出去的约束是
"completely deserted, NOT A SINGLE PERSON"。可这一镜的全部内容就是一个人的帽子。
引擎照放人不误 —— 而因为没有任何【成年男性/白袍/毡帽】的正面约束,
它自己编了红袍、女子、两个人、以及没有人的空袍子。

这是同一个错误的第四次变体, 前三次是: no person(弱否定) / NO_HUMAN=""(空约束) /
AT MOST ONE person(被读成"放一个进去")。这次是【分类错了, 所以约束发反了】。
教训升一级: 不要用正则去猜一个镜头该不该有人 —— 分镜表里直接标死。

正面表述, 每镜只说这一镜【需要什么】。
"""
import json, re, subprocess

TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True, text=True).stdout.split("=",1)[1].strip().strip('"')

SCENE = json.load(open("/tmp/rumi_scene.json"))
PLATE = json.load(open("/tmp/rumi_plates.json"))
STYLE = open("/tmp/rumi_style.txt").read()

# 一个完整的人 —— "complete body with a head" 是对【空袍子站着】的正面写法
DERVISH = (
 " EXACTLY ONE person is in frame: one ADULT MALE Sufi dervish, and he is a COMPLETE HUMAN BEING — "
 "head, face, neck, shoulders, both arms, both hands and both feet are all present and connected. "
 "A garment is never standing, spinning or moving on its own; every robe in frame is worn by this man. "
 "He wears a PLAIN WHITE floor-length robe with a wide skirt — the robe is WHITE, not red, not black, "
 "not blue, not gold. On his head is a tall plain cylindrical camel-hair FELT cap, light brown. "
 "His hair is short and dark and stays entirely under the cap. He is a man, not a woman. "
 "There is only ONE dancer — never a second person anywhere in the frame.")

# 手部特写: 芭蕉那只悬空的手换来的写法 —— 手必须连到看得见的小臂和肩
HANDS = (" A man's hand enters the frame ATTACHED to a visible forearm, and that forearm continues into "
         "a visible white sleeve and shoulder — the hand is clearly part of a whole person standing there. "
         "The skin is an adult man's. Never a hand alone, never a hand fading into the background.")

EMPTY = (" This place is completely deserted: the frame contains only architecture, ground, objects and "
         "light. NOT A SINGLE PERSON anywhere — no figure in a doorway, none at the far end of the street, "
         "no silhouette on the horizon.")

LAMP = (" Any lamp is a SIMPLE SHALLOW CLAY OIL LAMP: a small earthenware saucer with a pinched lip and a "
        "floating wick, open flame, sitting on the ground. No glass, no metal body, no handle, no chimney.")

# label -> (这一镜需要什么, 额外一句)
JOBS = {
  "p2#1":  (HANDS, " The hand lowering the lamp comes out of a WHITE sleeve. No red cloth in frame."),
  "p2#7":  (EMPTY, ""),
  "p2#17": (EMPTY, " The sand is smooth and unmarked — no footprints at all."),
  "p3#7":  (DERVISH, " Framed from the chest down: the white robe hem falls to the floor and is still. "
                     "The man's body continues upward out of frame — this is a crop, not a headless garment."),
  "p3#8":  (DERVISH, " He takes off his BLACK outer cloak and lowers it to the floor. The black cloak ends "
                     "up LYING FLAT AND EMPTY on the ground. He remains standing beside it in his white robe. "
                     "The black cloak never stands upright by itself."),
  "p3#10": (DERVISH, " Close on his tall felt cap — the cap is ON HIS HEAD, his forehead and eyes just "
                     "below it, side backlight."),
  "p3#11": (HANDS, " His right hand turns over, palm up toward the sky."),
  "p3#12": (HANDS, " His left hand turns over, palm down toward the ground."),
  "p3#13": (DERVISH, " He stands still with both arms out: right palm up, left palm down. Whole man visible."),
  "p3#14": (DERVISH, " He takes the first step — toe touches the floor, the body begins to turn. WHITE robe."),
  "p3#16": (DERVISH, " He is turning; the hem of his WHITE robe begins to lift off the floor."),
  "p3#19": (DERVISH, " Freeze on him mid-turn, the WHITE skirt opened halfway."),
  "p3#21": (DERVISH, " The WHITE skirt is fully open into a circle around him as he spins."),
  "p3#29": (DERVISH, " His cap stays perfectly still while the WHITE robe spins around him — the head is the axis."),
  "p3#30": (DERVISH, " Faster now, the WHITE skirt lifted higher. ONE dancer only."),
  "p3#36": (DERVISH, " The fastest moment — the WHITE skirt has become one flat plane around him."),
  "p3#42": (DERVISH, " He slows; the WHITE skirt settles back down toward the floor."),
}

def clean(d): return re.sub(r"\s+", " ", re.sub(r"\*\*", "", d)).strip()

def post(body):
    for _ in range(3):
        r = subprocess.run(["curl","-s","-m","900","-X","POST",
            "http://127.0.0.1:3000/api/admin/mv-shot","-H",f"x-admin-token: {TOK}",
            "-H","content-type: application/json","--data-binary",json.dumps(body)],
            capture_output=True, text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {}
        if j.get("ok") and j.get("video"): return j["video"]
    return None

shots = json.load(open("/tmp/rumi-shotlist.json"))
desc = {f"{pk}#{r[1]}": r[5] for pk in ("p1","p2","p3") for r in shots[pk]}
dur  = {f"{pk}#{r[1]}": r[4] for pk in ("p1","p2","p3") for r in shots[pk]}

out = {}
print(f"返修 {len(JOBS)} 镜")
for lbl, (need, extra) in JOBS.items():
    pk, num = lbl.split("#")
    v = post({"shot": f"rm{pk[1]}{num}s", "project": "rumi",
              "model": "bytedance/seedance-1.5-pro", "duration_secs": int(dur[lbl]),
              "image_url": PLATE[pk[1]],
              "prompt": SCENE[pk[1]] + clean(desc[lbl]) + STYLE + need + extra + LAMP})
    if v: out[lbl] = v
    print(("✅ " if v else "❌ ") + lbl, flush=True)
json.dump(out, open("/srv/cssos/tmp/rumi-sama-fix.json", "w"))
print(f"成功 {len(out)}/{len(JOBS)}")
