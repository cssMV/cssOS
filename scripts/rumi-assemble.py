#!/usr/bin/env python3
"""CSSOS_WAVE_2011 20260827 — 《مولانا رومی 鲁米三部曲》后期 + 装配。

在 api-vm 上跑。四步:
  1) 下载全部镜头
  2) 色板收敛(全片统一一道) —— 引擎守不住三色板, 会跑回"航拍风光大片"(样镜实测)
  3) 装配: duration = next_start - start  【铁律, 不是把各镜时长相加】
     《寻寻觅觅》就是在这里错过一次: 337s vs 355s。
  4) 落 R2

第三部还多一步:「同一片苔」的呼应 —— #24 与返照那一镜必须是同一片苔。
1.5-pro 守不住(实测两次都换了一片), 所以【不重新生成】, 直接对 #24 那一条后期布光。
参数见 docs/mv/wangwei-wangchuan-trilogy-storyboard.md 三·五。

用法: python3 wangchuan-assemble.py [p1|p2|p3|all]
"""
import json, os, subprocess, sys, hashlib

SHOTLIST = "/tmp/rumi-shotlist.json"
PROGRESS = "/srv/cssos/tmp/rumi-shoot-progress.json"
WORK     = "/srv/cssos/tmp/rumi-assemble"
AUDIO    = {"p1": 347.1, "p2": 327.4, "p3": 343.8}
OUT_NAME = {"p1": "rumi-p1-neyname-realvideo.mp4",
            "p2": "rumi-p2-biya-realvideo.mp4",
            "p3": "rumi-p3-sama-realvideo.mp4"}

# 尺寸归一 —— 拼接要 stream copy(无损), 参数必须完全一致。
# 《旧时相识》54 镜里就混进过一镜 1280x720, 当时是手工发现手工补的。
# 等比放大再居中裁, 不拉伸变形。
NORM = "scale=1470:630:force_original_aspect_ratio=increase,crop=1470:630"

# 色板收敛。CSSOS_WAVE_2011 —— 鲁米的方向与前两部【相反】。
#   辋川 推青(石青/苔绿/月白) · 奥の細道 压绿提墨(墨黑/苔緑/雪白)
#   鲁米  【提暖金 · 保住烛光】—— 土黄/赭红/靛蓝 + 烛金。
# 前两部都在压暖色, 这一部如果照抄, 会把苏菲道堂的暖金洗成第三部辋川。
# 所以这里 colorbalance 往红黄推(而不是往蓝推), 饱和度只轻降(保住地毯的赭红),
# 黑位略抬(泥墙不能死黑), 高光留住(烛焰不能烧飞)。
GRADE = (NORM + ","
         "colorbalance=rs=0.06:gs=0.02:bs=-0.05:rm=0.05:gm=0.01:bm=-0.06:"
         "rh=0.04:gh=0.02:bh=-0.03,"
         "eq=saturation=0.88:contrast=1.02:brightness=0.01:gamma_r=1.04,"
         "curves=all='0/0.04 0.5/0.51 1/0.97',format=yuv420p")

def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True,
                          capture_output=True, text=True, **kw)

def assemble(pk):
    shots = json.load(open(SHOTLIST))[pk]
    prog  = json.load(open(PROGRESS))
    d = f"{WORK}/{pk}"
    os.makedirs(d, exist_ok=True)
    missing = [str(s[1]) for s in shots if not prog.get(f"{pk}:{s[1]}", {}).get("ok")]
    if missing:
        sys.exit(f"{pk}: 还有 {len(missing)} 镜没拍成: {missing[:12]}")

    # 1) 下载 + 2) 逐镜调色 + 按 next_start-start 精确定长
    parts = []
    for i, (_act, num, a, b, dur, _desc) in enumerate(shots):
        # 铁律: 这一镜该占多久 = 下一镜的 start 减自己的 start; 末镜到音频真末尾。
        need = (shots[i + 1][2] - a) if i + 1 < len(shots) else (AUDIO[pk] - a)
        url = prog[f"{pk}:{num}"]["url"]
        raw = f"{d}/raw_{i:03d}.mp4"
        cut = f"{d}/cut_{i:03d}.mp4"
        if not os.path.exists(cut):
            if not os.path.exists(raw):
                sh(["curl", "-s", "-o", raw, url])
            # 素材若比需要的短(4/6/8 量化 vs 真间隔), 用末帧定格补足 —— 绝不留黑帧
            have = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "csv=p=0", raw]).stdout.strip())
            vf = GRADE
            if have + 0.05 < need:
                vf = f"tpad=stop_mode=clone:stop_duration={need - have + 0.2:.3f},{GRADE}"
            sh(["ffmpeg", "-y", "-v", "error", "-i", raw, "-vf", vf,
                "-t", f"{need:.3f}", "-r", "24",
                "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.2",
                "-crf", "18", "-an", cut])
        parts.append(cut)

    # 3) 拼接(全部同参数 -> 可以 stream copy, 无损)
    lst = f"{d}/concat.txt"
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    out = f"{WORK}/{OUT_NAME[pk]}"
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", "-movflags", "+faststart", out])
    got = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "csv=p=0", out]).stdout.strip())
    print(f"{pk}: {len(parts)} 镜 -> {got:.2f}s (音频 {AUDIO[pk]}s, 差 {got - AUDIO[pk]:+.2f}s)  {out}")
    return out, got

def upload(path):
    key = f"artifacts/mv/{os.path.basename(path)}"
    sh(["rclone", "copyto", path, f"r2:cssos-artifacts/{key}"])
    return f"https://cdn.cssstudio.app/{key}"

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    keys = ["p1", "p2", "p3"] if which == "all" else [which]
    for k in keys:
        out, _ = assemble(k)
        print("  ->", upload(out))
