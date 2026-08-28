#!/usr/bin/env python3
"""CSSOS_WAVE_2020 — 鲁米重拍(新剧本)。用法: rumi-shoot-v2.py [plates|p1|p2|p3|all]

在场约束直接读分镜表第四列, 不再用正则猜(W2018 的教训)。
四种在场: 无 / 女(一位) / 群(5-9位) / 男(一位)。
"""
import json, os, re, subprocess, sys

ROOT = "/srv/cssos/tmp"
SHOTS = json.load(open("/tmp/rumi-shotlist-v2.json"))
PROG_F = f"{ROOT}/rumi-v2-progress.json"
PLATE_F = f"{ROOT}/rumi-v2-plates.json"
TOK = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                     capture_output=True, text=True).stdout.split("=",1)[1].strip().strip('"')

WORLD = (
 "Persia, around the year 1250, the age of Rumi — Konya and the Iranian plateau. "
 "Architecture is mud-brick and carved stone with TURQUOISE AND LAPIS GLAZED TILE, muqarnas vaults, "
 "pointed arches, wooden doors with iron studs. Textiles are the real luxury of the Silk Road: "
 "layered SILK AND BROCADE in lapis blue, saffron, pomegranate red, rose and gold thread. "
 "Any lamp is a SHALLOW CLAY SAUCER with a floating wick and an open flame, or a pierced brass "
 "lantern — never glass-chimneyed, never electric. Everything visible must be possible in 1250: "
 "no wires, no poles, no concrete, no window glass, no metal railings. ")

STYLE = (" Cinematic 32:9 ultra-widescreen, anamorphic, shot on film, firelight and natural light, "
         "the color of a Persian miniature — deep lapis, saffron, gold. No text, no subtitles, "
         "no watermark. Physically real: nobody floats or flies, nobody stands on water, hands have "
         "exactly five fingers, faces are whole and well-formed, shadows all fall the same way. ")

SCENE = {
 "p1": WORLD + "DAWN, a reed marsh on the plateau and then the road to the city. Pale gold light, "
       "mist on the water. ",
 "p2": WORLD + "DUSK INTO NIGHT, the lanes of the city and a carpeted courtyard. Everything is lit by "
       "hundreds of small open flames. ",
 "p3": WORLD + "NIGHT, inside a domed hall — a single shaft of moonlight falls through the oculus at "
       "the crown of the dome onto a great carpet. Candles line the walls. ",
}

# ── 在场约束: 逐镜说【这一镜需要什么】, 正面表述 ──────────────────────────
WOMAN = (" EXACTLY ONE person is in frame: a beautiful young Persian woman, and she is a COMPLETE HUMAN "
         "BEING — head, face, neck, shoulders, both arms, both hands, both feet, all present and joined "
         "to one body. No garment ever stands, moves or spins with nobody inside it. She wears LAYERED "
         "SILK — a long full skirt over an under-skirt, a fitted bodice, long sleeves, a fine gauze veil "
         "and a jewelled band across the brow; her dark hair is long and braided or loose beneath it. "
         "Her face is calm and beautiful and clearly visible. There is only ONE person in frame. ")
GROUP = (" A GROUP OF PERSIAN WOMEN is in frame — between five and nine of them, every one a COMPLETE "
         "HUMAN BEING with head, face, arms and feet joined to one body. No garment ever moves with "
         "nobody inside it. Each wears LAYERED SILK skirts of a different colour — lapis, saffron, "
         "pomegranate, rose, green, gold — with long sleeves and a gauze veil. They are young and "
         "beautiful. They move together, as one body. No men are present. ")
MAN   = (" EXACTLY ONE person is in frame: one adult Persian man, a COMPLETE HUMAN BEING with head, "
         "face, arms and feet joined to one body, in a plain long robe and a simple felt cap. ")
NONE  = (" This place is completely deserted: the frame holds only landscape, architecture, objects and "
         "light. NOT A SINGLE PERSON anywhere — nobody in a doorway, nobody at the far end, no figure "
         "on the horizon, no silhouette. ")
WHO = {"无": NONE, "女": WOMAN, "群": GROUP, "男": MAN}

def clean(d): return re.sub(r"\s+", " ", re.sub(r"\*\*", "", d)).strip()

def post(path, body, tries=6):
    """CSSOS_WAVE_2024b — 重试必须【退避】, 失败必须【带出原因】。

    第一版是 `for _ in range(3)` 无间隔重试, 而且失败只返回 None。
    两部并行开拍时供应商限流, 三次重试在几秒内烧完 -> 一镜记失败,
    163 镜里 150 镜就是这么"失败"的 —— 而单镜直测 85 秒就成功。
    我因此一度以为是 prompt 被内容过滤了, 差点回去改剧本。

    退避 30/60/120/240/480s; 每次把服务端真实响应打出来。
    (同一个毛病今天已经栽了两次: 封面回填 12 张失败 7 张也是它。)"""
    import time as _t
    last = ""
    for i in range(tries):
        if i: _t.sleep(min(480, 30 * (2 ** (i - 1))))
        r = subprocess.run(["curl","-s","-m","900","-X","POST",f"http://127.0.0.1:3000{path}",
            "-H",f"x-admin-token: {TOK}","-H","content-type: application/json",
            "--data-binary", json.dumps(body)], capture_output=True, text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {}
        if j.get("ok"): return j
        last = (r.stdout or r.stderr or "no output")[:150].replace(chr(10), " ")
        if i: print(f"    重试 {i}: {last}", flush=True)
    print(f"    放弃: {last}", flush=True)
    return None

def make_plates():
    want = {
      "p1": SCENE["p1"] + "A reed marsh at dawn, still water, tall reeds with white plumes, mist, the "
            "outline of a walled city far off. UNINHABITED — not a single person." + STYLE,
      "p2": SCENE["p2"] + "A narrow mud-brick lane at dusk with a small clay oil lamp burning on the "
            "ground, wooden doors along both walls. UNINHABITED — not a single person." + STYLE,
      "p3": SCENE["p3"] + "The inside of a domed hall at night: a great patterned carpet on the floor, "
            "a shaft of moonlight from the oculus falling on its centre, candles along the walls, "
            "turquoise tilework. UNINHABITED — not a single person." + STYLE,
    }
    out = json.load(open(PLATE_F)) if os.path.exists(PLATE_F) else {}
    for k, p in want.items():
        if out.get(k): print(f"跳过 {k}"); continue
        j = post("/api/admin/mv-plate", {"project": "rumi2", "name": f"rumi2-{k}", "prompt": p})
        url = (j or {}).get("plate") or (j or {}).get("image")
        if url: out[k] = url
        print(("✅ " if url else "❌ ") + k, url or "")
    json.dump(out, open(PLATE_F, "w")); return out

def shoot(keys):
    plates = json.load(open(PLATE_F))
    prog = json.load(open(PROG_F)) if os.path.exists(PROG_F) else {}
    todo = [r for k in keys for r in SHOTS[k]]
    print(f"待拍 {len(todo)} 镜")
    for pk, num, t0, t1, dur, desc, who in todo:
        key = f"{pk}:{num}"
        if prog.get(key, {}).get("ok"): continue
        j = post("/api/admin/mv-shot", {
            "shot": f"rv{pk[1]}{num}", "project": "rumi2",
            "model": "bytedance/seedance-1.5-pro", "duration_secs": int(dur),
            "image_url": plates[pk],
            "prompt": SCENE[pk] + clean(desc) + STYLE + WHO[who]})
        url = (j or {}).get("video")
        prog[key] = {"ok": bool(url), "url": url, "dur": dur, "who": who}
        json.dump(prog, open(PROG_F, "w"))
        print(("✅ " if url else "❌ ") + f"{key} {dur}s [{who}]", flush=True)
    done = sum(1 for v in prog.values() if v.get("ok"))
    print(f"--- 清单 {len(todo)} 镜, 累计成功 {done} 镜 " + ("✅" if done >= len(todo) else "⚠️ 有缺"))

if __name__ == "__main__":
    m = sys.argv[1] if len(sys.argv) > 1 else "plates"
    if m == "plates": make_plates()
    elif m == "all":  shoot(["p1","p2","p3"])
    else:             shoot([m])
