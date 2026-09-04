#!/usr/bin/env python3
"""CSSOS_WAVE_2064 — 《Popol Wuj · 玛雅三部曲》批量拍摄(162 镜)。在 api-vm 上跑。

沿用《奥の細道》实拍换来的四条(scripts/basho-shoot.py):
  · 每部一张锚图 —— 三部是三个完全不同的地方, 一张服务不了
  · 每部一段【英文场景语境】钉在每镜之前 —— 只给中文短句会被模型的通用印象带走
  · 断点续拍 —— 每镜拍完立刻落盘, 162 镜跑一两小时, 断了不能从头(那是真金白银)
  · 并发 3, 失败重试 3 次不阻塞整批

本次新增: 人物约束按【分镜表的人列】逐镜发, 且一律正面表述(W2018/W2003 的教训)。
"""
import json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

SHOTLIST = "/tmp/maya-shotlist.json"
PROGRESS = "/srv/cssos/tmp/maya-shoot-progress.json"
API      = "http://127.0.0.1:3000/api/admin/mv-shot"
MODEL    = "bytedance/seedance-1.5-pro"   # A/B 实测: 大景与前二档难分高下, 女主角五官【最像玛雅】, 且省 $163

PLATE = {
 "p1": "https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-b4b1b37ac89fe9be.png",
 "p2": "https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-0e61ef08e5dc8dac.png",
 "p3": "https://cdn.cssstudio.app/artifacts/mv-plates/maya/plate-09763999e5965e88.png",
}
SCENE = {
 "p1": ("The Maya underworld Xibalba and the world just above it, pre-Columbian Guatemala, mythic. "
        "Deep-green gloom, bone-white leafless trees on wet black earth, a black river, drifting "
        "fireflies, jade and obsidian glints; limestone step-pyramids stand unlit in the far haze. "),
 "p2": ("A Maya stone ballcourt and the nine houses of Xibalba at night, pre-Columbian Guatemala, mythic. "
        "Near-black shadow with orange torchlight and lime-white stone; a carved stone ring high on each "
        "sloped wall; nine empty stone seats on the terrace above. "),
 "p3": ("The Guatemalan highland at dawn after rain, pre-Columbian Maya, mythic. Gold-green terraced maize, "
        "black volcanic soil between the rows, a round jade-green cenote, a limestone step-pyramid on the "
        "ridge catching the first gold light, jungle canopy and drifting mist beyond. "),
}
# 逐镜人物约束 —— 一律正面表述(「此地空无一人」而非「不要有人」)
PERSON = {
 "无": (" This place is UNINHABITED: it is deserted for miles, and the horizon holds no figure of any kind."),
 "人": (" Exactly one young Maya woman is present and she is the only person here: long black hair to the "
        "waist, a deep-red woven huipil, a jade bead necklace. Her head, face, neck, shoulders, both arms, "
        "both hands with five fingers each, and both feet are complete and connected to one body."),
 "二": (" Exactly two young Maya men are present and they are the only people here: the hero twins, bare "
        "chested with woven loincloths and jade ear flares. Each of the two has his own head, face, neck, "
        "shoulders, both arms, both hands with five fingers each, and both feet, complete and connected."),
}
STYLE = (" Shot on anamorphic lenses, cinematic ultrawide 21:9, natural light only, rich film grain, "
         "no on-screen text, no subtitles, no watermark.")

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def shoot(tok, part, num, dur, desc, who):
    tag = f"my{part[-1]}{num}"
    prompt = SCENE[part] + desc.replace("**","") + PERSON.get(who, PERSON["无"]) + STYLE
    assert int(dur) in (4,6,8), f"非法时长 {dur}"
    body = {"shot": tag, "project": "maya", "model": MODEL,
            "duration_secs": int(dur), "image_url": PLATE[part], "prompt": prompt}
    j = {}
    for attempt in range(3):
        r = subprocess.run(["curl","-s","-m","900","-X","POST",API,
            "-H",f"x-admin-token: {tok}","-H","content-type: application/json",
            "--data-binary",json.dumps(body)], capture_output=True, text=True)
        try: j = json.loads(r.stdout)
        except Exception: j = {"ok": False, "raw": r.stdout[:200]}
        if j.get("ok") and j.get("video"):
            return {"ok": True, "url": j["video"], "dur": int(dur)}
        time.sleep(20 * (attempt + 1))     # 退避; 并打印真错误, 不猜原因
    return {"ok": False, "err": str(j)[:220]}

def main():
    tok = subprocess.run(["bash","-c","grep -o 'CSSOS_ADMIN_TOKEN=[^ ]*' /etc/cssos.env|head -1|cut -d= -f2-|tr -d '\"'"],
                         capture_output=True, text=True).stdout.strip()
    sl = json.load(open(SHOTLIST)); prog = load(PROGRESS, {})
    todo = [(p, s) for p in ("p1","p2","p3") for s in sl[p] if f"{p}#{s[1]}" not in prog]
    if "--status" in sys.argv:
        ok = sum(1 for v in prog.values() if v.get("ok"))
        print(f"进度 {len(prog)}/162 · 成功 {ok} · 失败 {len(prog)-ok} · 待拍 {len(todo)}"); return
    print(f"待拍 {len(todo)} 镜(已完成 {len(prog)})", flush=True)
    os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
    lock = __import__("threading").Lock()
    def run(item):
        p, s = item
        _, num, _, _, dur, desc, who = s
        r = shoot(tok, p, num, dur, desc, who)
        with lock:
            prog[f"{p}#{num}"] = r
            json.dump(prog, open(PROGRESS,"w"), ensure_ascii=False)
            done = len(prog); ok = sum(1 for v in prog.values() if v.get("ok"))
            print(f"[{done}/162] {p}#{num} {'OK ' if r['ok'] else 'FAIL'} {r.get('err','')[:90]}", flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(run, todo))
    ok = sum(1 for v in prog.values() if v.get("ok"))
    print(f"=== 完成: 成功 {ok} / 失败 {len(prog)-ok} / 清单 162 ===")
    if ok + (len(prog)-ok) != 162: print("⚠️ 处理数 ≠ 清单 162, 有漏")

main()
