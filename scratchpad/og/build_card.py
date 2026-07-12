#!/usr/bin/env python3
# Build 1200x630 og:image share card — flagship-cover collage + tagline
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
GREEN = (0, 245, 160)
card = Image.new("RGB", (W, H), (8, 10, 12))

# --- 3 flagship covers as full-bleed vertical panels (crop-to-fill) ---
covers = ["scratchpad/og/c1.jpg", "scratchpad/og/c3.jpg", "scratchpad/og/c2.jpg"]
gap = 4
panel_w = (W - gap * 2) // 3
x = 0
for i, p in enumerate(covers):
    im = Image.open(p).convert("RGB")
    # crop-to-fill panel_w x H
    src_ratio = im.width / im.height
    dst_ratio = panel_w / H
    if src_ratio > dst_ratio:
        nh = H
        nw = int(H * src_ratio)
    else:
        nw = panel_w
        nh = int(panel_w / src_ratio)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - panel_w) // 2
    top = (nh - H) // 2
    im = im.crop((left, top, left + panel_w, top + H))
    card.paste(im, (x, 0))
    x += panel_w + gap

# --- bottom scrim (dark gradient for text legibility) ---
scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(scrim)
top_y = 300
for y in range(top_y, H):
    t = (y - top_y) / (H - top_y)
    a = int(245 * (t ** 1.5))
    sd.line([(0, y), (W, y)], fill=(4, 6, 8, a))
# left vignette for wordmark
for xx in range(0, 560):
    t = 1 - xx / 560
    a = int(150 * (t ** 1.6))
    sd.line([(xx, 0), (xx, H)], fill=(4, 6, 8, a))
card = Image.alpha_composite(card.convert("RGBA"), scrim).convert("RGB")

d = ImageDraw.Draw(card)

def font(sz, bold=True):
    f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", sz)
    try:
        f.set_variation_by_name("Bold" if bold else "Regular")
    except Exception:
        pass
    return f

# --- brand top accent line ---
d.rectangle([0, 0, W, 5], fill=GREEN)

# --- top-left kicker pill ---
kick = "CSS STUDIO"
kf = font(24, True)
kb = d.textbbox((0, 0), kick, font=kf)
kw, kh = kb[2] - kb[0], kb[3] - kb[1]
px, py = 56, 48
d.rounded_rectangle([px, py, px + kw + 40, py + kh + 24], radius=999,
                    fill=(0, 245, 160, 255))
d.text((px + 20, py + 10), kick, font=kf, fill=(6, 12, 10))

# --- wordmark ---
wm = "cssOS"
wf = font(112, True)
d.text((54, H - 232), wm, font=wf, fill=GREEN)

# --- tagline ---
tag = "Watch + create AI music videos — with sound"
tf = font(40, True)
d.text((58, H - 108), tag, font=tf, fill=(240, 244, 246))

# --- url (bottom-right) ---
url = "cssstudio.app"
uf = font(34, True)
ub = d.textbbox((0, 0), url, font=uf)
uw = ub[2] - ub[0]
d.text((W - uw - 56, H - 60), url, font=uf, fill=GREEN)

# --- play glyphs on covers (subtle) ---
for cx in [panel_w // 2, panel_w + gap + panel_w // 2, 2 * (panel_w + gap) + panel_w // 2]:
    cy = 150
    r = 34
    ring = Image.new("RGBA", (r * 2 + 8, r * 2 + 8), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([4, 4, r * 2 + 4, r * 2 + 4], fill=(8, 10, 12, 150),
               outline=(255, 255, 255, 210), width=3)
    tri = [(r - 8, r - 16), (r - 8, r + 16), (r + 16, r)]
    rd.polygon([(a + 4, b + 4) for a, b in tri], fill=(255, 255, 255, 235))
    card.paste(ring, (cx - r - 4, cy - r - 4), ring)

out = "public/og/share.png"
import os
os.makedirs("public/og", exist_ok=True)
card.save(out, "PNG")
# also jpg (smaller, twitter-friendly)
card.save("public/og/share.jpg", "JPEG", quality=88)
print("saved", out, card.size)
