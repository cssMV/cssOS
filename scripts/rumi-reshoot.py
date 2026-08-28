#!/usr/bin/env python3
"""CSSOS_WAVE_2012b — 鲁米违规判定 + 重拍。

判定按【这一镜该不该有人】分开算 —— 这是本片与前两部最大的不同:
  · 无人镜(136 镜): 出现任何人 = 违规
  · 有人镜(27 镜):  人数>1 / 皮毛帽 / 披发 = 违规
  · 两类都: 现代物 > 0 = 违规

为什么必须分开: 我原来给全部 163 镜发同一句 "AT MOST ONE person"(至多一人),
模型把它读成了【放一个人】—— 于是 136 个本该空无一人的镜头里都站了个人。
约束只说了允许什么, 没说需要什么。

重拍时用【正面表述】而不是否定式(这条已验证三次: 锚图的 UNINHABITED、
芭蕉最后 3 镜的"方圆几里没有别人"、本次的"地平线上也没有灯")。
"""
import json, re, subprocess, sys

RES   = "/tmp/rmresults.txt"
SHOTS = "/tmp/rumi-shotlist.json"
PROG  = "/srv/cssos/tmp/rumi-shoot-progress.json"
OUT   = "/srv/cssos/tmp/rumi-reshoot.json"

HAS_PERSON = re.compile(r"人影|行者|笠影|一双手|手指|只拍手|只拍脚|赤脚|背影|剪影|他|舞|旋转|坐着|站立|弯腰")

SCENE = json.load(open("/tmp/rumi_scene.json"))
PLATE = json.load(open("/tmp/rumi_plates.json"))
STYLE = open("/tmp/rumi_style.txt").read()

PERSON_ONE = (" EXACTLY ONE person is present: an ADULT MALE Sufi dervish. He wears a plain "
              "cylindrical camel-hair FELT hat (sikke) — NOT a fur hat — with short dark hair "
              "completely under it, NO long loose hair. Plain long white robe. "
              "NEVER two or more people, NO crowd, NO woman, NO child.")
PERSON_NONE = (" This place is completely deserted — there is NOT A SINGLE PERSON anywhere in the "
               "frame, near or far, no silhouette, no figure on the horizon. The frame contains only "
               "landscape, architecture, objects and light. NO lamps or lights on the horizon, "
               "NO glowing points in the distance.")
NO_MODERN = (" Everything visible must be possible in the year 1250: no wires, no poles, no concrete, "
             "no glass, no metal railings, no electric light of any kind.")

def clean(d):
    return re.sub(r"\s+", " ", re.sub(r"\*\*", "", d)).strip()

def main():
    shots = json.load(open(SHOTS))
    desc = {f"{pk}#{r[1]}": r[5] for pk in ("p1","p2","p3") for r in shots[pk]}
    dur  = {f"{pk}#{r[1]}": r[4] for pk in ("p1","p2","p3") for r in shots[pk]}
    rows = [l.strip().split("|") for l in open(RES) if l.strip()]
    viol = []
    for r in rows:
        lbl, h, hat, lh, md = r[0], int(r[1]), r[2], r[3] == "1", int(r[4])
        want = bool(HAS_PERSON.search(desc.get(lbl, "")))
        why = []
        if md > 0: why.append(f"现代物{md}")
        if want:
            if h > 1: why.append(f"人数{h}")
            if hat == "fur": why.append("皮毛帽")
            if lh: why.append("披发")
        else:
            if h > 0: why.append(f"该无人却有{h}人")
        if why: viol.append((lbl, ",".join(why), want))
    print(f"{len(rows)} 镜, 违规 {len(viol)} 镜")
    for l, w, _ in viol[:40]: print("  ", l, w)
    if "--dry" in sys.argv: return

    tok = subprocess.run(["sudo","grep","-E","^CSSOS_ADMIN_TOKEN=","/etc/cssos.env"],
                         capture_output=True,text=True).stdout.split("=",1)[1].strip().strip('"')
    out = {}
    for lbl, _why, want in viol:
        pk, num = lbl.split("#")
        body = {"shot": f"rm{pk[1]}{num}r", "project": "rumi",
                "model": "bytedance/seedance-1.5-pro", "duration_secs": int(dur[lbl]),
                "image_url": PLATE[pk[1]],
                "prompt": SCENE[pk[1]] + clean(desc[lbl]) + STYLE
                          + (PERSON_ONE if want else PERSON_NONE) + NO_MODERN}
        ok = False
        for _ in range(3):
            r = subprocess.run(["curl","-s","-m","900","-X","POST",
                "http://127.0.0.1:3000/api/admin/mv-shot","-H",f"x-admin-token: {tok}",
                "-H","content-type: application/json","--data-binary",json.dumps(body)],
                capture_output=True,text=True)
            try: j = json.loads(r.stdout)
            except Exception: j = {}
            if j.get("ok") and j.get("video"):
                out[lbl] = j["video"]; ok = True; break
        print(("✅ " if ok else "❌ ") + lbl, flush=True)
    json.dump(out, open(OUT, "w"))
    print(f"重拍成功 {len(out)}/{len(viol)}")

if __name__ == "__main__":
    main()
