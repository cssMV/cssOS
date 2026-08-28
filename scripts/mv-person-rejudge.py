#!/usr/bin/env python3
"""CSSOS_WAVE_2009 — 人物合规【重判】: 用细化规则重新评价已有的校验结果。

为什么需要它: 原规则「人>1 或 露脸 或 占宽>0.14」太钝, 把分镜【刻意要的肢体特写】
判成违规。实例: 芭蕉 p1#1 原文「一双草鞋的结, 被手指拉紧。只有手与绳, 不见人。」——
校验器把手算成人(对的)、占 75% 宽(也对), 于是判违规; 但它没违规, 是规则不适用。
看图确认: 一只手在系草鞋, 无脸无第二人。校验器把「手+袖子」数成了 2 人。

细化后:
  ·「≤1/8 宽」只对【出现人形】的镜头生效; 刻意的手/脚/衣特写豁免
  · 这类镜头人数放宽到 ≤2(手+袖常被数成两人), 但【露脸一律违规】
用法: python3 mv-person-rejudge.py <results.txt> <shotlist.json>
      results 行格式: label|humans|face(0/1)|widest|url
"""
import json, re, sys

PART = re.compile(r"只拍手|只有手|只拍脚|无脚|只拍衣|只拍影子|手不入画|不见人|只到手腕|只到下颌")

def main(res_path, shot_path):
    shots = json.load(open(shot_path))
    desc = {}
    for pk in ("p1", "p2", "p3"):
        for _a, n, _x, _y, _d, t in shots.get(pk, []):
            desc[f"{pk}#{n}"] = t
    rows = [l.strip().split("|") for l in open(res_path) if l.strip()]
    bad = []
    for r in rows:
        lbl, h, f, w = r[0], int(r[1]), r[2] == "1", float(r[3])
        is_part = bool(PART.search(desc.get(lbl, "")))
        why = ""
        if h > (2 if is_part else 1): why = f"人数{h}"
        elif f:                        why = "露脸"
        elif w > 0.14 and not is_part: why = f"占宽{w}"
        if why: bad.append((lbl, why))
    print(f"{len(rows)} 镜, 按细化规则违规 {len(bad)} 镜")
    for lbl, why in bad: print(" ", lbl, why)
    return bad

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
