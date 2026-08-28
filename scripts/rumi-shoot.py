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

SHOTLIST = "/tmp/rumi-shotlist.json"
PROGRESS = "/srv/cssos/tmp/rumi-shoot-progress.json"
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
# CSSOS_WAVE_2008 — 鲁米三部曲。每部一张锚图(芭蕉那次"一张锚图服务三个地方"的教训),
# 每镜前钉一段英文场景语境(芭蕉那次"中文短句压不住通用印象"的教训)。
SCENE = {
 "1": ("A tall reed bed at dusk in 13th-century Anatolia, reeds taller than a man, the wind pressing "
       "them all one way; one reed has been cut and its pale hollow stump is fresh. Earth-ochre ground, "
       "indigo sky. "),
 "2": ("NIGHT in a 13th-century Konya street of mud-brick walls. A heavy wooden door stands HALF OPEN; "
       "just inside on the ground a single oil lamp burns and its gold light spills through the gap onto "
       "the empty street. Ochre walls, indigo night, one small gold flame. "),
 "3": ("Inside a 13th-century Sufi lodge: octagonal polished wooden floor, red-ochre carpet, ochre walls, "
       "shafts of light from a ring of high windows, thick drifting dust, oil lamps along the walls. "),
}
PLATE_BY_PART = {
    "1": "https://cdn.cssstudio.app/artifacts/mv-plates/rumi/plate-a-reeds-57e29a0e8b45ad34.png",
    "2": "https://cdn.cssstudio.app/artifacts/mv-plates/rumi/plate-b-door-18aba792216fb0eb.png",
    "3": "https://cdn.cssstudio.app/artifacts/mv-plates/rumi/plate-c-hall-d20543292e8db90a.png",
}
PLATE_FIGURE = "https://cdn.cssstudio.app/artifacts/mv-plates/rumi/plate-d-dervish-fed663fe98a32e7a.png"
# 本片色板与前两部相反 —— 暖金是本色, 不再禁暖光。规则跟着作品走, 不跟着上一部走。
STYLE = (" Palette: earth ochre, red-ochre, indigo night, and the gold of candle and oil-lamp flame. "
         "13th-century Anatolia, Seljuk Persian world. Long lens compression, no wide-angle distortion, "
         "no drone move, no handheld shake. Cinematic photoreal, warm restrained grade. "
         "NO modern object: no wires, no concrete, no cars, no plastic, no electric light, no modern clothing. "
         "Silent, no text, no watermark.")
# CSSOS_WAVE_2012 —— 人物约束必须【按镜判断该不该有人】, 不能只给上限。
#
# 我原来写的是 "AT MOST ONE person may appear"(至多一人)。实拍结果:
# p1#3「大远景: 整片苇丛在风里倒向一侧」、p1#4「风过, 苇穗齐齐翻白」——
# 分镜里这两镜【都没有人】(第一个人影要到 #13 才极小地出现), 可画面正中都站着一个人。
# 【模型把"至多一人"读成了"放一个人"。】
# 约束只说了允许什么, 没说需要什么。
#   芭蕉那次: 上限留空 -> 出现三个人
#   这次:     给了上限 -> 每镜都塞一个
# 两次都是同一个毛病的两面。
#
# 修法: 从分镜描述判断这一镜该不该有人 —— 描述里出现 人/影/手/行者/脚 的才给人,
# 其余一律钉死"无人", 且用【正面表述】(锚图那次证明 UNINHABITED 有效、no people 无效)。
import re as _re
_HAS_PERSON = _re.compile(r"人影|行者|笠影|一双手|手指|只拍手|只拍脚|赤脚|背影|剪影|他|舞|旋转|坐着|站立|弯腰")
PERSON_ONE = (" EXACTLY ONE person is present: an ADULT MALE Sufi dervish. "
              "He wears a plain cylindrical camel-hair FELT hat (sikke) — NOT a fur hat — "
              "with short dark hair completely under it, NO long loose hair. Plain long white robe. "
              "NEVER two or more people, NO crowd, NO audience, NO woman, NO child.")
PERSON_NONE = (" This place is completely deserted — there is NOT A SINGLE PERSON anywhere in the frame, "
               "near or far, and no silhouette, no figure on the horizon, no crowd. "
               "The frame contains only landscape, architecture, objects and light. "
               "No lamps or lights on the horizon, no glowing points in the distance.")
def person_clause(desc):
    return PERSON_ONE if _HAS_PERSON.search(desc or "") else PERSON_NONE
PERSON = PERSON_ONE
NO_HUMAN = PERSON

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
    tag = f"rm{part}{str(num).replace('.', 'x')}"
    prompt = SCENE.get(str(part), SCENE["1"]) + clean(desc) + STYLE + person_clause(desc)
    body = {"shot": tag, "project": "rumi", "model": MODEL,
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
