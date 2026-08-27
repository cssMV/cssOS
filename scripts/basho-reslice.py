#!/usr/bin/env python3
# CSSOS_WAVE_1998 — 芭蕉版重切(与 wangchuan-reslice.py 同一套算法, 只换输入)。
import json, re, sys, math

ROOT = "/Users/cssos/cssOS"
SB   = f"{ROOT}/docs/mv/basho-okunohosomichi-storyboard.md"
TL   = f"{ROOT}/docs/mv/basho-timeline"

PARTS = [
    # 幕的节段划分按【真时间轴】数出来的(见 docs/mv/basho-timeline/*.json):
    #   一幕 = 前奏 -> Chorus 1 结束; 二幕 = -> Chorus 2 结束; 三幕 = Bridge -> Outro
    dict(key="p1", name="夏草", tl="b1-natsukusa", audio=368.0,
         acts=[("一幕 · 行路", 1, 17), ("二幕 · 金色堂", 18, 35), ("三幕 · 夢の跡", 36, 54)],
         act_sections=[6, 6, 7]),
    dict(key="p2", name="閑さや", tl="b2-shizukasa", audio=376.8,
         acts=[("一幕 · 千段", 1, 17), ("二幕 · 蝉", 18, 35), ("三幕 · 静", 36, 54)],
         act_sections=[6, 6, 6]),
    dict(key="p3", name="荒海や", tl="b3-araumi", audio=388.7,
         acts=[("一幕 · 荒海", 1, 17), ("二幕 · 佐渡", 18, 35), ("三幕 · 天河", 36, 55)],
         act_sections=[6, 6, 6]),
]

# 第二部一幕镜数不够(16 镜最多只能铺 128s, 而真时长 137.7s) —— 补两镜。
# 补在【43.3s 纯器乐前奏】里, 与该幕"一根一根竹划过、光柱渐熄"的语言一致, 不是硬凑。
# 《荒海や》一幕镜数不够: 17 镜 x 8s = 136s 铺不满真时长 144.1s。
# 补两镜在 33.5s 纯器乐前奏里(那段全是海), 用该幕既有的语言, 不是硬凑。
EXTRA = {
    ("p3", 1): [
        (2, "浪在礁石间退去, 露出湿黑的岩脊, 又被下一道浪吞没。完全静止。"),
        (4, "极缓推, 推向海天相接的那条线; 那里除了白, 什么都没有。"),
    ],
}

def parse_storyboard():
    txt = open(SB, encoding="utf-8").read()
    # 只取三个「第N部」正文里的分镜行
    out = {}
    marks = [m.start() for m in re.finditer(r"^# 第[一二三]部", txt, re.M)]
    marks.append(txt.index("## 三 · 执行清单"))
    for i, key in enumerate(["p1", "p2", "p3"]):
        body = txt[marks[i]:marks[i + 1]]
        # 芭蕉分镜表是三列 | # | 秒 | 镜头 |(没有规划时间列, 因为一开始就说明要按真轴重切)
        rows = re.findall(r"^\| (\d+) \| (\d+) \| (.+?) \|\s*$", body, re.M)
        out[key] = [(int(n), float(sec), desc.strip()) for n, sec, desc in rows]
    return out

def sections(part):
    d = json.load(open(f"{TL}/{part['tl']}.subtitle-take1.json", encoding="utf-8"))
    return d["languages"][0]["sections"]

def quantize(n_shots, dur, weights):
    """把 dur 秒切成 n_shots 段, 每段只能是 4/6/8 秒。
    做法: 按各镜【原定时长的比例】分配目标秒数 -> 就近取 4/6/8 -> 再逐镜微调补足差额。
    (第一版是"先尽量给 8, 剩下用 6 补" —— 结果 4s×21 / 6s×2 / 8s×31 的双峰分布,
     那是算法的产物, 不是导演对节奏的意图。比例法能把原分镜的长短关系带过来。)"""
    S = int(round(dur / 2.0)) * 2
    S = max(4 * n_shots, min(8 * n_shots, S))
    tot_w = sum(weights) or 1.0
    durs = []
    for w in weights:
        target = S * (w / tot_w)
        durs.append(min((4, 6, 8), key=lambda q: (abs(q - target), q)))
    # 修差: 每次挑一个"离它的比例目标最远"的镜, 升/降一档
    def targets():
        return [S * (w / tot_w) for w in weights]
    tg = targets()
    guard = 0
    while sum(durs) != S and guard < 4000:
        guard += 1
        diff = S - sum(durs)
        step = 2 if diff > 0 else -2
        cand = [i for i in range(n_shots) if 4 <= durs[i] + step <= 8]
        if not cand:
            break
        # 升档时优先给"目标比现值大最多"的; 降档反之
        i = max(cand, key=lambda i: (tg[i] - durs[i]) * (1 if step > 0 else -1))
        durs[i] += step
    return durs, sum(durs)


def main():
    sb = parse_storyboard()
    report = []
    total_shots = total_secs = 0
    for part in PARTS:
        secs = sections(part)
        shots = sb[part["key"]]
        # 幕边界 = 真节段边界(按每幕包含几个 section 顺序切)
        bounds, cur = [], 0
        for n in part["act_sections"]:
            start = secs[cur]["t_start"] / 1000.0
            cur += n
            end = (secs[cur]["t_start"] / 1000.0) if cur < len(secs) else part["audio"]
            bounds.append((start, end))
        bounds[0] = (0.0, bounds[0][1])           # 第一幕从 0 起
        bounds[-1] = (bounds[-1][0], part["audio"])  # 末幕到音频真末尾
        lines = []
        cursor = 0.0
        for ai, (act_name, s0, s1) in enumerate(part["acts"]):
            act_shots = [s for s in shots if s0 <= s[0] <= s1]
            extra = EXTRA.get((part["key"], ai + 1), [])
            for after, desc in sorted(extra, key=lambda x: -x[0]):
                pos = next(i for i, s in enumerate(act_shots) if s[0] == after)
                act_shots.insert(pos + 1, (after + 0.5, 6.0, "【W1991 补镜】" + desc))
            a0 = cursor if ai else 0.0        # 接上一幕的【实际落点】, 不用原始节段边界 ->
            a1 = bounds[ai][1]                #   幕交界不再出现断点(第一版每部有 2 处)
            if ai == len(part["acts"]) - 1:
                a1 = part["audio"]            # 末幕必须收在音频真末尾
            D = a1 - a0
            w = [s[1] for s in act_shots]
            durs, S = quantize(len(act_shots), D, w)
            t = a0
            for (num, _old, desc), dsec in zip(act_shots, durs):
                lines.append((act_name, num, round(t, 2), round(t + dsec, 2), dsec, desc))
                t += dsec
            cursor = t
            # 幕内量化总和与真时长的差, 记下来(装配时由 next_start-start 吸收)
            report.append((part["name"], act_name, len(act_shots), round(D, 1), S, round(D - S, 1)))
        part["lines"] = lines
        total_shots += len(lines)
        total_secs += sum(l[4] for l in lines)
    # 打印核对表
    print("部       幕            镜数   真时长   量化和   差")
    for r in report:
        print(f"{r[0]:<8}{r[1]:<14}{r[2]:>4}{r[3]:>9.1f}{r[4]:>9}{r[5]:>7.1f}")
    print(f"\n合计 {total_shots} 镜 / {total_secs}s 素材")
    print(f"拍摄成本 {total_secs*3.5:.0f} credits = ${total_secs*3.5*0.005:.2f}")
    json.dump({p["key"]: p["lines"] for p in PARTS},
              open("/private/tmp/claude-501/-Users-cssos-cssOS/ac7fcdfc-3533-4030-90fe-8ddc9af58c94/scratchpad/basho-shotlist.json", "w"),
              ensure_ascii=False)
    return PARTS

if __name__ == "__main__":
    main()
