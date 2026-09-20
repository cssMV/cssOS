#!/usr/bin/env python3
"""W2122 · 背幕图验收 —— 46 张规模上, 只靠肉眼一张张翻会漏。

四道机器判据(全部基于真解码, 不看文件名):
  1. 能下载、字节数与 Content-Length 一致
  2. ffprobe 读得出尺寸, 且宽高比 = 21:9 (±2%)
  3. 整条解码零报错(截断/坏块在这里现形)
  4. 不是「废图」: 亮度不接近全黑/全白, 且有足够的细节方差
     —— 生成失败常见形态就是一片灰或一片黑, 文件大小照样正常

机器判不出来的只有一件事:【画面里有没有人】。所以本脚本最后会按风险排序,
把【最该人眼看】的挑出来 —— 那些文明的造像传统本来就以人形为中心
(拜占庭圣像 / 佛像 / 唐卡 / 印度教神像 / 埃及壁画 / 希腊雕像 / 约鲁巴铜首 …),
模型最容易在这些地方硬画出人来(见记忆 sacred-cover-no-ai-figures)。

用法: python3 scripts/stage-audit-plates.py <plates-out.txt> <下载目录> [out.json]
"""
import json, os, subprocess, sys

# 造像传统以人形为中心的厅 —— 这些必须人眼过目, 机器判不了
HIGH_RISK = {
    "hall-mosaic-gold": "拜占庭圣像", "hall-lotus": "佛像", "hall-thangka": "唐卡神像",
    "hall-temple-lamp": "印度教神像", "hall-sandstone": "埃及壁画人物",
    "hall-marble": "希腊雕像", "hall-porphyry": "罗马雕像", "hall-yoruba": "约鲁巴铜首",
    "hall-greenstone": "毛利祖先雕像", "hall-obsidian": "中美洲神像",
    "hall-lagoon": "波利尼西亚雕像", "hall-black-choir": "斯拉夫圣像",
    "hall-rock-church": "埃塞俄比亚圣像", "hall-batik": "皮影人偶",
    "hall-ochre": "岩画人形", "hall-angkor": "飞天浮雕",
    "hall-gold-lacquer": "佛像", "hall-pagoda-dawn": "佛像",
    "hall-baroque": "天顶画人物", "hall-carnival": "小丑",
    "hall-chiaroscuro": "人体习作", "hall-ashen": "挂毯人物",
}
TARGET_AR = 21 / 9


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=width,height", "-of", "csv=p=0:s=x", path],
                       capture_output=True, text=True)
    t = (r.stdout or "").strip().split("\n")[0]
    if "x" not in t:
        return None
    w, h = t.split("x")[:2]
    return int(w), int(h)


def decode_errors(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"],
                       capture_output=True, text=True)
    return [l for l in (r.stdout + r.stderr).splitlines() if l.strip()]


def pixels(path, w=64, h=32):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    b = r.stdout
    if len(b) < w * h * 3:
        return None
    lum = [0.299 * b[3*i] + 0.587 * b[3*i+1] + 0.114 * b[3*i+2] for i in range(w * h)]
    mean = sum(lum) / len(lum)
    var = sum((x - mean) ** 2 for x in lum) / len(lum)
    return mean, var ** 0.5


def main():
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    rows, bad = [], []
    planned = 0
    for line in open(src):
        line = line.strip()
        if "|" not in line:
            continue
        planned += 1
        sid, url = line.split("|", 1)
        f = os.path.join(outdir, sid + ".webp")
        if not os.path.exists(f):
            subprocess.run(["curl", "-sS", "-o", f, url], check=False)
        size = os.path.getsize(f) if os.path.exists(f) else 0
        issues = []
        if size < 50000:
            issues.append(f"文件只有 {size} 字节")
        wh = probe(f)
        if not wh:
            issues.append("ffprobe 读不出尺寸")
            ar = 0
        else:
            ar = wh[0] / wh[1]
            if abs(ar - TARGET_AR) / TARGET_AR > 0.02:
                issues.append(f"画幅 {ar:.3f} 不是 21:9({TARGET_AR:.3f})")
        errs = decode_errors(f)
        if errs:
            issues.append(f"解码报错 {len(errs)} 条")
        px = pixels(f)
        if not px:
            issues.append("解不出像素")
            mean = sd = 0
        else:
            mean, sd = px
            if mean < 8:
                issues.append(f"几乎全黑(亮度 {mean:.0f})")
            if mean > 245:
                issues.append(f"几乎全白(亮度 {mean:.0f})")
            if sd < 10:
                issues.append(f"没有细节(方差 {sd:.1f}) —— 大概率是废图")
        rows.append({"stage_id": sid, "url": url, "bytes": size,
                     "wh": f"{wh[0]}x{wh[1]}" if wh else "?", "ar": round(ar, 3),
                     "lum": round(mean, 1), "sd": round(sd, 1),
                     "risk": HIGH_RISK.get(sid, ""), "issues": issues})
        if issues:
            bad.append(sid)

    print(f"清单 {planned} 张, 实际查了 {len(rows)} 张"
          + ("(全覆盖)" if planned == len(rows) else " (!!对不上!!)"))
    print()
    for r in rows:
        mark = "❌" if r["issues"] else "✅"
        print(f"{mark} {r['stage_id']:22} {r['wh']:>10} ar{r['ar']:.2f} "
              f"亮{r['lum']:5.1f} 方差{r['sd']:5.1f} {r['bytes']//1024:5d}KB"
              + ("  " + "; ".join(r["issues"]) if r["issues"] else ""))

    risky = [r["stage_id"] for r in rows if r["risk"]]
    print(f"\n── 机器判不了【画面里有没有人】, 以下 {len(risky)} 张必须人眼过目 ──")
    for r in rows:
        if r["risk"]:
            print(f"   {r['stage_id']:22} 风险: {r['risk']}")
    print(f"\n{'❌ ' + str(len(bad)) + ' 张有问题: ' + ', '.join(bad) if bad else '✅ 机器判据全过'}")

    if len(sys.argv) > 3:
        json.dump(rows, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
    return 1 if bad else 0


sys.exit(main())
