#!/usr/bin/env python3
"""CSSOS_WAVE_1993 20260827 — 《王维·辋川三部曲》批量拍摄(163 镜)。

在 api-vm 上跑(要读 /etc/cssos.env 的 admin token, 且走本机 :3000)。

设计要点:
  · 断点续拍 —— 每镜拍完立刻写进度文件; 中断后重跑只补没拍的。
    163 镜跑一两个小时, 中途任何原因断掉都不能从头再来(那是真金白银)。
  · 时长只发 4/6/8 —— seedance 收 7 秒但兜底链上的 veo 只收 4/6/8,
    回落时非法时长会整镜失败(#42a 踩过)。清单里本来就只有这三种, 这里再守一道。
  · 第三部【只传地貌锚】—— 「空山不见人」是字面意思, 传人物锚就是废片。
  · 失败重试 3 次, 仍失败则记进 failed 列表继续往下, 不阻塞整批。
  · 并发 3 —— KIE 文档是 20 次/10s, 3 路远在限内; 更高并发在这个项目上没必要,
    上次封号的教训是宁可慢。

用法:
  python3 wangchuan-shoot.py            # 拍(可反复跑, 自动续)
  python3 wangchuan-shoot.py --status   # 只看进度
"""
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

SHOTLIST = "/tmp/basho-shotlist.json"
PROGRESS = "/srv/cssos/tmp/basho-shoot-progress.json"
API      = "http://127.0.0.1:3000/api/admin/mv-shot"
MODEL    = "bytedance/seedance-1.5-pro"

# CSSOS_WAVE_1999 20260827 — 【每部一张锚图】, 不是三部共用一张。
#
# 这是实拍逼出来的修正: 一开始照《辋川》的做法只出一张地貌锚(白天的杉林山景),
# 结果三部#36「银河横贯」拍出来是【白天的湖 + 一棵松】—— 锚图把每一镜都拽回
# "雾中绿山"。根因: 《辋川》三部都在【同一个山谷】, 一张锚图够用;
# 《奥の細道》三部是【三个完全不同的地方】——
#   平泉的草原 / 立石寺的赤岩 / 出雲崎的夜海。一张锚图服务不了三个地方。
PLATE_BY_PART = {
    "1": "https://cdn.cssstudio.app/artifacts/mv-plates/basho/plate-p1-hiraizumi-46b5a93d5d0b1606.png",
    "2": "https://cdn.cssstudio.app/artifacts/mv-plates/basho/plate-p2-yamadera-3ffcacfab77873aa.png",
    "3": "https://cdn.cssstudio.app/artifacts/mv-plates/basho/plate-p3-izumozaki-b48e6e9ba1a396c6.png",
}
PLATE_FIGURE  = "https://cdn.cssstudio.app/artifacts/mv-plates/basho/plateB-traveller-01e3ee498f29c1e7.png"

# CSSOS_WAVE_1999b 20260827 — 【每部一段英文场景语境】必须钉在每一镜前面。
#
# 这是实拍逼出来的第二处修正。只给一句中文动作(「天河出现, 自画面最左至最右」)
# 拍出来是【白天的湖 + 一棵松】; 换了正确的夜海锚图之后, 拍出来变成
# 【月夜村落 + 灯笼 + 建筑】—— 把明令禁止的暖光和人造物全画上了。
# 根因不在锚图, 在提示太短: 一句中文的信息量不足以压住模型对"日本夜景"的通用印象,
# 它就回落到那个印象上去了。
# 《辋川》没暴露这个问题, 是因为那些中文短句碰巧与"雾中绿山"的锚图同向。
#
# 实测(同一镜三次):
#   中文短句 + 白天山景锚 -> 白天的湖 + 松树        ❌
#   中文短句 + 夜海锚      -> 月夜村落 + 灯笼        ❌
#   英文场景 + 英文动作    -> 夜海 + 佐渡 + 银河     ✅
#   英文场景 + 中文动作    -> 夜海 + 佐渡 + 银河     ✅  <- 采用(不必把 165 句全译)
SCENE = {
 "1": ("An UNINHABITED open highland field at Hiraizumi, northern Japan, Edo period, high summer, "
       "overcast. Waist-high summer grass moves like water; half-buried foundation stones are almost "
       "swallowed by it; a slow river glints pewter and low green mountains fade into mist behind. "),
 "2": ("A mountain temple cliff at Risshaku-ji, northern Japan, Edo period, high summer. Towering "
       "reddish-brown volcanic rock pitted with small empty carved niches, thick moss in the cracks, "
       "very straight tall cedars in front, pale shafts of light between them, worn stone steps "
       "climbing into the trees. "),
 "3": ("NIGHT on a deserted shore at Izumozaki, Edo-period Japan. Heavy white surf breaks across the "
       "bottom of the frame; far out a long low BLACK ISLAND lies horizontally; above it the MILKY WAY "
       "stretches horizontally right across the sky. Three horizontal bands: silver stars on top, "
       "black island in the middle, white surf below. "),
}
STYLE = (" Palette strictly three colours: ink black, moss green, snow white"
         " (part three adds the silver of the stars)."
         " NO warm orange, NO lantern, NO fire, NO saturated red, NO moon, NO village, NO houses."
         " Natural light only. Long lens compression, no wide-angle distortion, no drone move,"
         " no handheld shake. Edo-period Japan — absolutely no modern object: no wires, no concrete,"
         " no ships, no road signs, no railings."
         " Cinematic photoreal, cold restrained grade. Silent, no text, no watermark.")
NO_HUMAN = ""   # 芭蕉三部都允许旅人剪影(≤1/8 宽, 背身无脸), 没有"无人部"

def load(p, d):
    try:
        with open(p) as f: return json.load(f)
    except Exception: return d

def save(p, o):
    tmp = p + ".tmp"
    with open(tmp, "w") as f: json.dump(o, f, ensure_ascii=False)
    os.replace(tmp, p)

def admin_token():
    out = subprocess.run(["sudo", "grep", "-E", "^CSSOS_ADMIN_TOKEN=", "/etc/cssos.env"],
                         capture_output=True, text=True).stdout
    return out.split("=", 1)[1].strip().strip('"') if "=" in out else ""

def clean(desc):
    """分镜描述是中文 + markdown 强调; 转成给引擎的干净英文语境提示。
    保留中文原意(引擎吃中文), 只去掉 markdown 记号和我们自己的批注。"""
    d = re.sub(r"\*\*|【W1991 补镜】", "", desc)
    d = re.sub(r"\s+", " ", d).strip()
    return d

def shoot(tok, part, idx, num, dur, desc, is_p3):
    tag = f"bs{part}{str(num).replace('.', 'x')}"
    prompt = SCENE.get(str(part), SCENE["1"]) + clean(desc) + STYLE
    body = {"shot": tag, "project": "basho", "model": MODEL,
            "duration_secs": int(dur), "image_url": PLATE_BY_PART.get(str(part), PLATE_BY_PART["1"]), "prompt": prompt}
    assert int(dur) in (4, 6, 8), f"非法时长 {dur} —— veo 兜底只收 4/6/8"
    for attempt in range(3):
        r = subprocess.run(
            ["curl", "-s", "-m", "900", "-X", "POST", API,
             "-H", f"x-admin-token: {tok}", "-H", "content-type: application/json",
             "--data-binary", json.dumps(body)],
            capture_output=True, text=True)
        try:
            j = json.loads(r.stdout)
        except Exception:
            j = {"ok": False, "raw": r.stdout[:200]}
        if j.get("ok") and j.get("video"):
            return {"ok": True, "url": j["video"], "tag": tag, "dur": int(dur)}
        time.sleep(6 * (attempt + 1))
    return {"ok": False, "tag": tag, "err": str(j)[:220]}

def main():
    shots = load(SHOTLIST, None)
    if not shots: sys.exit("缺 " + SHOTLIST)
    prog = load(PROGRESS, {})
    jobs = []
    for pk in ("p1", "p2", "p3"):
        for i, (_act, num, _a, _b, dur, desc) in enumerate(shots[pk]):
            key = f"{pk}:{num}"
            if prog.get(key, {}).get("ok"): continue
            jobs.append((pk, i, num, dur, desc, False, key))
    total = sum(len(shots[k]) for k in ("p1", "p2", "p3"))
    done = sum(1 for v in prog.values() if v.get("ok"))
    print(f"共 {total} 镜, 已完成 {done}, 待拍 {len(jobs)}")
    if "--status" in sys.argv: return
    if not jobs: print("全部拍完"); return
    tok = admin_token()
    if not tok: sys.exit("拿不到 admin token")
    lock = __import__("threading").Lock()
    counter = {"n": done, "fail": 0}

    def run(job):
        pk, i, num, dur, desc, is_p3, key = job
        res = shoot(tok, pk[1], i, num, dur, desc, False)
        with lock:
            prog[key] = res
            save(PROGRESS, prog)
            counter["n"] += 1 if res.get("ok") else 0
            if not res.get("ok"): counter["fail"] += 1
            mark = "✅" if res.get("ok") else "❌"
            print(f"{mark} [{counter['n']}/{total}] {key} {dur}s "
                  + (res.get("url", "").split("/")[-1] if res.get("ok") else res.get("err", ""))[:60],
                  flush=True)

    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(run, jobs))
    print(f"\n完成 {counter['n']}/{total}, 失败 {counter['fail']}")
    if counter["fail"]:
        print("失败的镜再跑一次本脚本即可(断点续拍会只补它们)")

if __name__ == "__main__":
    main()
