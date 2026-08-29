#!/usr/bin/env python3
"""CSSOS_WAVE_2024 — 通用装配器(鲁米 v2 / 萨福 共用一份)。

用法: python3 mv-assemble.py <project> [p1|p2|p3|all]

前四部各写了一份几乎一样的装配脚本, 这份把它们收成一个 —— 差异只有配置。

【铁律 · 不要再错第二次】
  每一镜占多久 = 【下一镜的 start 减自己的 start】, 不是把各镜时长相加。
  《寻寻觅觅》就是在这里错过一次: 337s vs 355s, 整片和音频错位。
  末镜一直铺到音频真末尾。

【尺寸归一】拼接走 stream copy(无损), 参数必须完全一致。
  《旧时相识》54 镜里混进过一镜 1280x720, 当时是手工发现手工补的 —— 现在强制归一。

【调色按部, 不按片】萨福的叙事轴就是【光的量】: 正午满 → 夜里退 → 破晓回。
  三部用同一道色板等于把它的叙事抹掉。鲁米则相反, 全片一道暖金 —— 它的三部
  是同一场欢宴的三个阶段, 色调断了反而散。
"""
import json, os, subprocess, sys

NORM = "scale=1470:630:force_original_aspect_ratio=increase,crop=1470:630"

def grade(extra):
    return NORM + "," + extra + ",format=yuv420p"

# 鲁米 v2: 波斯细密画 —— 深靛蓝 + 藏红花金。全片一道。
RUMI_G = grade("colorbalance=rs=0.06:gs=0.02:bs=-0.04:rm=0.05:gm=0.01:bm=-0.05:"
               "rh=0.04:gh=0.02:bh=-0.02,"
               "eq=saturation=0.94:contrast=1.03:brightness=0.01:gamma_r=1.04,"
               "curves=all='0/0.04 0.5/0.52 1/0.97'")

CONF = {
 "rumi2": dict(
   shotlist="/tmp/rumi-shotlist-v2.json",
   progress="/srv/cssos/tmp/rumi-v2-progress.json",
   work="/srv/cssos/tmp/rumi2-assemble",
   audio={"p1": 347.1, "p2": 327.4, "p3": 343.8},
   out={"p1": "rumi-v2-p1-neyname.mp4", "p2": "rumi-v2-p2-biya.mp4", "p3": "rumi-v2-p3-sama.mp4"},
   grade={"p1": RUMI_G, "p2": RUMI_G, "p3": RUMI_G}),
 "meghaduta": dict(
   shotlist="/tmp/meghaduta-shotlist.json",
   progress="/srv/cssos/tmp/megha-shoot-progress.json",
   work="/srv/cssos/tmp/megha-assemble",
   # 出歌之后由 meghaduta-prep.py 按【解码实测】写进 megha-audio-len.json,
   # 装配时读它 —— 绝不在这里手写一个数(ffprobe 对 VBR 会谎报)。
   audio=__import__("json").load(open("/srv/cssos/tmp/megha-audio-len.json")),
   out={"p1": "megha-p1-purvamegha.mp4", "p2": "megha-p2-marga.mp4",
        "p3": "megha-p3-uttaramegha.mp4"},
   # 云使按【部】调色 —— 三部的光是三种天气, 不是三种风格:
   #   一 旱季末转骤雨: 干、硬、然后压暗
   #   二 雨中飞行: 散射光, 低对比, 湿绿
   #   三 阿罗迦: 月与花, 青金 + 月白, 提亮不提暖
   grade={
     "p1": grade("eq=saturation=0.86:contrast=1.10:brightness=0.01:gamma_r=1.05,"
                 "colorbalance=rs=0.07:gs=0.02:bs=-0.05:rm=0.04:bm=-0.04:rh=0.03:bh=-0.02,"
                 "curves=all='0/0.02 0.5/0.50 1/0.98'"),
     "p2": grade("eq=saturation=0.90:contrast=0.96:brightness=0.02:gamma_g=1.04,"
                 "colorbalance=rs=-0.03:gs=0.04:bs=0.03:rm=-0.02:gm=0.03:bm=0.02,"
                 "curves=all='0/0.07 0.5/0.52 1/0.95'"),
     "p3": grade("eq=saturation=0.95:contrast=1.02:brightness=0.03:gamma_b=1.04,"
                 "colorbalance=rs=-0.04:gs=0.00:bs=0.08:rm=-0.02:bm=0.06:rh=0.03:bh=0.03,"
                 "curves=all='0/0.05 0.5/0.54 1/1'")}),
 "meghaduta": dict(
   shotlist="/tmp/meghaduta-shotlist.json",
   progress="/srv/cssos/tmp/megha-shoot-progress.json",
   work="/srv/cssos/tmp/megha-assemble",
   audio={"p1": 376.09, "p2": 352.21, "p3": 358.59},
   out={"p1": "megha-p1-purvamegha.mp4", "p2": "megha-p2-marga.mp4", "p3": "megha-p3-uttaramegha.mp4"},
   grade={
     # 一 · 相遇: 旱季末 → 第一场雨。压暖、提对比, 焦土的赭红要留住, 雨到时天要沉下来。
     "p1": grade("eq=saturation=0.90:contrast=1.06:brightness=0.00:gamma_r=1.03,"
                 "colorbalance=rs=0.05:gs=0.01:bs=-0.04:rm=0.03:bm=-0.03,"
                 "curves=all='0/0.03 0.5/0.50 1/0.97'"),
     # 二 · 云路: 全程在雨里飞。降饱和、抬黑位(雨天没有死黑), 绿要湿不要艳。
     "p2": grade("eq=saturation=0.84:contrast=0.98:brightness=0.02:gamma_g=1.03,"
                 "colorbalance=rs=-0.03:gs=0.03:bs=0.04:rm=-0.02:gm=0.02:bm=0.03,"
                 "curves=all='0/0.07 0.5/0.52 1/0.96'"),
     # 三 · 阿罗迦: 永恒的春天 + 月光。青金与月白, 曼陀罗花的橙不能被洗掉。
     "p3": grade("eq=saturation=0.96:contrast=1.04:brightness=0.01:gamma_b=1.04,"
                 "colorbalance=rs=-0.02:bs=0.06:rm=0.02:bm=0.04:rh=0.03:bh=0.02,"
                 "curves=all='0/0.04 0.5/0.53 1/0.98'")}),
 "sappho": dict(
   shotlist="/tmp/sappho-shotlist.json",
   progress="/srv/cssos/tmp/sappho-shoot-progress.json",
   work="/srv/cssos/tmp/sappho-assemble",
   audio={"p1": 282.15, "p2": 293.00, "p3": 298.57},
   out={"p1": "sappho-p1-phainetai.mp4", "p2": "sappho-p2-dedyke.mp4", "p3": "sappho-p3-mnasesthai.mp4"},
   grade={
     # 一 · 在场: 正午。提亮、降饱和、压对比 —— 白到发晃, 影子却是硬的。
     "p1": grade("eq=saturation=0.82:contrast=1.06:brightness=0.04:gamma=1.03,"
                 "colorbalance=rs=0.02:bs=0.03:rh=0.02:bh=0.02,"
                 "curves=all='0/0.06 0.5/0.55 1/1'"),
     # 二 · 消失: 夜。整体压暗推靛, 只留高光那一点月白不许染蓝。
     "p2": grade("eq=saturation=0.78:contrast=1.10:brightness=-0.05:gamma=0.94,"
                 "colorbalance=rs=-0.05:gs=-0.02:bs=0.10:rm=-0.04:bm=0.08:rh=0.01:bh=0.01,"
                 "curves=all='0/0 0.5/0.44 1/0.96'"),
     # 三 · 留存: 破晓。回暖, 但不回到第一部的白 —— 是赭石与莎草黄。
     "p3": grade("eq=saturation=0.92:contrast=1.02:brightness=0.02:gamma_r=1.05,"
                 "colorbalance=rs=0.07:gs=0.03:bs=-0.05:rm=0.05:bm=-0.04:rh=0.05:bh=-0.02,"
                 "curves=all='0/0.03 0.5/0.53 1/0.98'")}),
}

def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True,
                          capture_output=True, text=True, **kw)

def assemble(proj, pk):
    c = CONF[proj]
    shots = json.load(open(c["shotlist"]))[pk]
    prog  = json.load(open(c["progress"]))
    d = f"{c['work']}/{pk}"
    os.makedirs(d, exist_ok=True)

    missing = [str(s[1]) for s in shots if not prog.get(f"{pk}:{s[1]}", {}).get("ok")]
    if missing:
        sys.exit(f"{pk}: 还有 {len(missing)} 镜没拍成: {missing[:12]}")

    audio_len = c["audio"][pk]
    parts = []
    for i, row in enumerate(shots):
        num, start = row[1], float(row[2])
        # 铁律: 该占多久 = 下一镜 start - 自己 start; 末镜铺到音频真末尾。
        end = float(shots[i + 1][2]) if i + 1 < len(shots) else audio_len
        need = max(0.2, round(end - start, 3))
        src = f"{d}/raw{num}.mp4"
        dst = f"{d}/cut{num}.mp4"
        if not os.path.exists(src) or os.path.getsize(src) < 4096:
            sh(["curl", "-s", "-m", "300", "-o", src, prog[f"{pk}:{num}"]["url"]])
        if not os.path.exists(dst) or os.path.getsize(dst) < 4096:
            # 素材若短于所需, 用末帧定格补足(tpad), 不加速不变形
            sh(["ffmpeg", "-nostdin", "-v", "error", "-i", src,
                "-vf", c["grade"][pk] + f",tpad=stop_mode=clone:stop_duration={need}",
                "-t", str(need), "-an", "-r", "24", "-c:v", "libx264", "-crf", "18",
                "-preset", "medium", "-pix_fmt", "yuv420p", dst, "-y"])
        parts.append(dst)

    lst = f"{d}/list.txt"
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    out = f"{c['work']}/{c['out'][pk]}"
    sh(["ffmpeg", "-nostdin", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", out, "-y"])
    real = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "csv=p=0", out]).stdout.strip())
    print(f"{pk}: {len(parts)} 镜 -> {real:.2f}s (音频 {audio_len}s, 差 {real-audio_len:+.2f}s)  {out}")
    if abs(real - audio_len) > 1.5:
        print(f"  ⚠️ {pk} 与音频差 {real-audio_len:+.2f}s —— 超出 1.5s, 不要上线")
    return out

if __name__ == "__main__":
    proj = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "all"
    keys = ["p1", "p2", "p3"] if mode == "all" else [mode]
    for k in keys:
        assemble(proj, k)
