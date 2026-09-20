#!/usr/bin/env python3
"""量【光源在哪】, 不是量【哪边颜色暖】。

v1 错在把 R/B 比当成光源方向: 妲己那张左侧堆满暖色青铜器, R/B 比高,
规则就判「光在左」—— 可真图里焚城明明在右边。材质颜色 ≠ 光源位置。

v2 的判据: 取最亮的 5% 像素(那就是光源和被它直射的面), 算它们的
  · 平均 x 位置(0=最左, 1=最右)
  · 平均色温 R/B
这才是「光从哪边来、是暖是冷」。
"""
import json, os, subprocess, sys

W, H = 96, 48

def probe(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    b = r.stdout
    if len(b) < W * H * 3:
        return None
    px = []
    for i in range(W * H):
        R, G, B = b[3*i], b[3*i+1], b[3*i+2]
        px.append((0.299*R + 0.587*G + 0.114*B, i % W, R, B))
    px.sort(key=lambda t: -t[0])
    top = px[:max(8, (W*H)//20)]          # 最亮的 5%
    x = sum(t[1] for t in top) / len(top) / (W - 1)
    warm = sum((t[2] + 1) / (t[3] + 1) for t in top) / len(top)
    lum = sum(t[0] for t in top) / len(top)
    return {"x": round(x, 3), "warm": round(warm, 2), "lum": round(lum, 1)}

rows = []
for line in open(sys.argv[1]):
    line = line.strip()
    if "|" not in line: continue
    sid, url = line.split("|", 1)
    f = os.path.join(sys.argv[2], sid + ".webp")
    if not os.path.exists(f):
        subprocess.run(["curl", "-sS", "-o", f, url], check=False)
    s = probe(f)
    if not s:
        print(f"{sid:18} ❌ 读不了"); continue
    side = "中" if 0.40 <= s["x"] <= 0.60 else ("右" if s["x"] > 0.60 else "左")
    kind = "暖" if s["warm"] >= 1.15 else ("冷" if s["warm"] <= 0.95 else "中性")
    rows.append({"stage_id": sid, "url": url, **s, "side": side, "kind": kind})
    print(f"{sid:18} 光源 x={s['x']:.2f} ({side})  色温 {s['warm']:.2f} ({kind})  亮度 {s['lum']:.0f}")
json.dump(rows, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
print(f"\n清单 {len(rows)} 张, 实际量了 {len(rows)} 张")
