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

SHOTLIST = "/tmp/wangchuan-shotlist.json"
PROGRESS = "/srv/cssos/tmp/wangchuan-shoot-progress.json"
API      = "http://127.0.0.1:3000/api/admin/mv-shot"
MODEL    = "bytedance/seedance-1.5-pro"

PLATE_TERRAIN = "https://cdn.cssstudio.app/artifacts/mv-plates/wangchuan/plateA-terrain-v2-7afd3a2c66221e14.png"
PLATE_FIGURE  = "https://cdn.cssstudio.app/artifacts/mv-plates/wangchuan/plateA-terrain-8902244088038121.png"

# 三部通用的风格尾巴 —— 和锚图、分镜的视觉系统一致。
# 色板守不住是已知的(样镜实测), 靠后期收敛; 这里仍然写上, 能守多少是多少。
STYLE = (" Palette strictly three colours: mineral azurite blue, moss green, moon white. "
         "No warm orange, no lantern, no fire, no saturated red. Natural light only. "
         "Long lens compression, no wide-angle distortion, no drone move, no handheld shake. "
         "Cinematic photoreal, cold restrained grade. Silent, no text, no watermark.")
NO_HUMAN = (" EMPTY OF ALL LIFE: no person, no human figure, no silhouette, no clothing, "
            "no animal, no building. Only rock, moss, water, bamboo, pine, mist and mountain.")

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
    tag = f"ww{part}{str(num).replace('.', 'x')}"
    prompt = clean(desc) + STYLE + (NO_HUMAN if is_p3 else "")
    body = {"shot": tag, "project": "wangchuan", "model": MODEL,
            "duration_secs": int(dur), "image_url": PLATE_TERRAIN, "prompt": prompt}
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
            jobs.append((pk, i, num, dur, desc, pk == "p3", key))
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
        res = shoot(tok, pk[1], i, num, dur, desc, is_p3)
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
