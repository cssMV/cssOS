#!/usr/bin/env python3
"""CSSOS_WAVE_2019 — 萨福版重切: 把分镜表按【真时间轴】铺满音频。

与王维/芭蕉同一套算法, 两处不同:
 1. 分镜表多了第四列【人】(无/人/二) —— W2018 的结构性堵法, 原样带进 shotlist,
    拍摄脚本直接读它决定发哪条约束, 不再用正则去猜。
 2. 幕的边界跟着【对齐后的 section】走, 而不是我事先估的秒数。

总时长铁律: sum(shot.dur) == 音频真时长(解码实测, 不信 ffprobe 的 VBR 报数)。
"""
import json, re, sys

ROOT = "/Users/cssos/cssOS"
SB   = f"{ROOT}/docs/mv/sappho-greek-storyboard.md"
TL   = f"{ROOT}/docs/mv/sappho-timeline"

PARTS = [
    dict(key="p1", tl="s1-phainetai",  audio=282.15, acts=[(1,18),(19,37),(38,55)]),
    dict(key="p2", tl="s2-dedyke",     audio=293.00, acts=[(1,18),(19,37),(38,55)]),
    dict(key="p3", tl="s3-mnasesthai", audio=298.57, acts=[(1,18),(19,37),(38,55)]),
]

def parse_storyboard():
    txt = open(SB, encoding="utf-8").read()
    marks = [m.start() for m in re.finditer(r"^# 第[一二三]部", txt, re.M)]
    marks.append(txt.index("## 五 · 执行清单"))
    out = {}
    for i, key in enumerate(["p1", "p2", "p3"]):
        body = txt[marks[i]:marks[i+1]]
        rows = re.findall(r"^\| (\d+) \| (\d+) \| (.+?) \| (无|人|二) \|\s*$", body, re.M)
        out[key] = [(int(n), float(s), d.strip(), who) for n, s, d, who in rows]
    return out

def act_bounds(part):
    """三幕的真实秒边界: 用对齐后的 section 起点, 取最接近 1/3、2/3 的那两个边界。"""
    try:
        d = json.load(open(f"{TL}/{part['tl']}.subtitle-take1.json", encoding="utf-8"))
        secs = d["languages"][0]["sections"]
        # t_start/t_end 是【毫秒】—— 直接当秒用会把幕界推到片尾之外(实测 p1 多出 9.9s)
        starts = [float(s["t_start"]) / 1000.0 for s in secs if float(s.get("t_end") or 0) > 0]
    except Exception as e:
        print(f"  ! {part['key']} 读不到时间轴({e}), 退回等分", file=sys.stderr)
        return [part["audio"] / 3.0, part["audio"] * 2 / 3.0]
    A = part["audio"]
    out = []
    for frac in (1/3.0, 2/3.0):
        target = A * frac
        out.append(min(starts, key=lambda t: abs(t - target)) if starts else target)
    return out

def quantize(weights, total):
    """把 total 秒切成 len(weights) 段, 每段只能是 4/6/8 秒, 按权重保住长短关系。"""
    n = len(weights)
    total = max(4 * n, min(8 * n, int(round(total / 2.0)) * 2))
    tw = sum(weights) or 1.0
    durs = []
    for w in weights:
        t = total * (w / tw)
        durs.append(min((4, 6, 8), key=lambda q: abs(q - t)))
    # 逐镜微调补足差额 —— 每次挑与理想值偏离最大的那镜动一档
    while sum(durs) != total:
        diff = total - sum(durs)
        step = 2 if diff > 0 else -2
        cand = [i for i in range(n) if 4 <= durs[i] + step <= 8]
        if not cand: break
        ideal = [total * (weights[i] / tw) for i in range(n)]
        i = max(cand, key=lambda i: (ideal[i] - durs[i]) * (1 if step > 0 else -1))
        durs[i] += step
    return durs

def main():
    sb = parse_storyboard()
    out = {}
    for part in PARTS:
        k = part["key"]
        rows = sb[k]
        assert len(rows) == 55, f"{k} 分镜 {len(rows)} 行, 应为 55"
        b1, b2 = act_bounds(part)
        segs = [(0.0, b1), (b1, b2), (b2, part["audio"])]
        res, t = [], 0.0
        for (lo, hi), (a0, a1) in zip(part["acts"], segs):
            grp = [r for r in rows if lo <= r[0] <= hi]
            durs = quantize([r[1] for r in grp], a1 - a0)
            for r, d in zip(grp, durs):
                res.append([k, r[0], round(t, 2), round(t + d, 2), d, r[2], r[3]])
                t += d
        out[k] = res
        who = {}
        for r in res: who[r[6]] = who.get(r[6], 0) + 1
        print(f"{k}: {len(res)} 镜 -> {t:.1f}s (音频 {part['audio']}s, 差 {t-part['audio']:+.1f}s)  {who}")
        assert abs(t - part["audio"]) < 2.5, f"{k} 铺不满"
    json.dump(out, open(f"{ROOT}/docs/mv/sappho-shotlist.json", "w"), ensure_ascii=False, indent=1)
    tot = sum(len(v) for v in out.values())
    print(f"--- 清单 165 镜, 实际写出 {tot} 镜 " + ("✅ 无遗漏" if tot == 165 else "⚠️ 有漏!"))

main()
