#!/usr/bin/env python3
# CSSOS_WAVE_2014 — 第三轮修正。
#
# ① 鲁米「现代物」不是误判 —— 看图确认: p2#3 右上角一根细电线; p2#10 那盏灯是
#    【玻璃罩 + 金属底座的煤油灯】(19 世纪), 不是 1250 年的东西。
#    根因: 我 prompt 里只写 "oil lamp", 模型就给维多利亚式煤油灯。形制必须写死。
# ② 旧时相识 js10 按 Jing 修正改为【岸边】(不是凉亭)。
import json, re, subprocess

TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True,text=True).stdout.split("=",1)[1].strip().strip('"')

# 灯的形制写死 + 明确排除电线
LAMP = (" Any lamp visible must be a SIMPLE SHALLOW CLAY OIL LAMP: a small hand-made earthenware "
        "saucer with a pinched lip and a floating wick, sitting directly on the ground or on stone. "
        "It has NO glass chimney, NO glass globe, NO metal body, NO handle, NO screw cap — it is "
        "just fired clay and an open flame.")
NOWIRE = (" The sky and the walls are completely clear: NO cables, NO wires, NO ropes strung overhead, "
          "NO poles. Every surface is mud-brick, stone, wood or cloth only.")

SCENE = json.load(open("/tmp/rumi_scene.json"))
PLATE = json.load(open("/tmp/rumi_plates.json"))
STYLE = open("/tmp/rumi_style.txt").read()
HAS = re.compile(r"人影|行者|笠影|一双手|手指|只拍手|只拍脚|赤脚|背影|剪影|他|舞|旋转|坐着|站立|弯腰")
ONE = (" EXACTLY ONE person is present: an ADULT MALE Sufi dervish in a plain cylindrical camel-hair "
       "FELT hat (sikke) — never a fur hat — with short dark hair completely under it, NO long loose "
       "hair. Plain long white robe. NEVER two or more people.")
NONE = (" This place is completely deserted — NOT A SINGLE PERSON anywhere in the frame, near or far, "
        "no silhouette, no figure on the horizon.")

def clean(d): return re.sub(r"\s+", " ", re.sub(r"\*\*", "", d)).strip()

def post(body):
    for _ in range(3):
        r = subprocess.run(["curl","-s","-m","900","-X","POST",
            "http://127.0.0.1:3000/api/admin/mv-shot","-H",f"x-admin-token: {TOK}",
            "-H","content-type: application/json","--data-binary",json.dumps(body)],
            capture_output=True,text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {}
        if j.get("ok") and j.get("video"): return j["video"]
    return None

# ---- ① 鲁米: 复验仍违规的那些镜 ----
shots = json.load(open("/tmp/rumi-shotlist.json"))
desc = {f"{pk}#{r[1]}": r[5] for pk in ("p1","p2","p3") for r in shots[pk]}
dur  = {f"{pk}#{r[1]}": r[4] for pk in ("p1","p2","p3") for r in shots[pk]}
rows = [l.strip().split("|") for l in open("/tmp/rmrev.txt") if l.strip()]
bad = []
for r in rows:
    lbl, h, hat, lh, md = r[0], int(r[1]), r[2], r[3] == "1", int(r[4])
    want = bool(HAS.search(desc.get(lbl, "")))
    if md > 0 or (want and (h > 1 or hat == "fur" or lh)) or (not want and h > 0):
        bad.append((lbl, want))
print(f"鲁米第三轮: {len(bad)} 镜")
out = {}
for lbl, want in bad:
    pk, num = lbl.split("#")
    v = post({"shot": f"rm{pk[1]}{num}r3", "project": "rumi",
              "model": "bytedance/seedance-1.5-pro", "duration_secs": int(dur[lbl]),
              "image_url": PLATE[pk[1]],
              "prompt": SCENE[pk[1]] + clean(desc[lbl]) + STYLE + (ONE if want else NONE) + LAMP + NOWIRE})
    if v: out[lbl] = v
    print(("✅ " if v else "❌ ") + lbl, flush=True)
json.dump(out, open("/srv/cssos/tmp/rumi-reshoot3.json", "w"))
print(f"鲁米第三轮成功 {len(out)}/{len(bad)}")

# ---- ② 旧时相识 js10: 岸边版(Jing 修正) ----
v = post({"shot": "js10b", "project": "xunxunmimi", "model": "bytedance/seedance-1.5-pro",
          "duration_secs": 8,
          "prompt": ("A solitary man in a Song-dynasty scholar robe STANDS ON THE SHORE at the edge of a "
            "misty lake. He is on DRY LAND: firm earth and stones under his feet, reeds and a low grassy "
            "bank around him, the water beginning a little way in front of him. He looks out across the "
            "lake. A huge golden moon hangs low over the far side; distant pavilions sit on the opposite "
            "bank. He is NOT in the water and NOT on the water — his feet rest on solid ground at the "
            "water's edge. Southern Song dynasty China, ink-wash cinematic palette, cold restrained "
            "grade, soft mist. Long lens, no drone move. No modern object, no text, no watermark.")})
print(("✅ js10b " if v else "❌ js10b ") + str(v))
json.dump({"js10": v}, open("/srv/cssos/tmp/js10-shore.json", "w"))
