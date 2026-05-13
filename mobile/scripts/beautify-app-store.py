#!/usr/bin/env python3
"""
CSSOS_APP_STORE_BEAUTIFIER 20260511 — Jing

Takes raw 1242×2688 iPhone screenshots → outputs 10 cssOS-branded
App Store screenshots with headline strips at top.

USAGE
=====

    # one-time setup (3 sec):
    pip3 install Pillow

    # 1. AirDrop your 10 chosen screenshots from iPhone to Mac.
    #    They land in ~/Downloads. Move them to ~/Desktop/cssOS-raw/
    #    and PREFIX them in the desired App Store order:
    #
    #      01-cinema-landscape.png
    #      02-hall-of-fame.png
    #      03-mv-pipeline.png
    #      04-brand-splash.png
    #      05-shakespeare-codex.png
    #      06-zhang-qian-playlist.png
    #      07-ai-creator-chat.png
    #      08-people-list.png
    #      09-language-grid.png
    #      10-engine-prefs.png
    #
    #    Alphabetical sort = App Store display order = headline order below.
    #
    # 2. Run:
    python3 ~/cssOS/mobile/scripts/beautify-app-store.py

    # 3. Beautified PNGs appear in ~/Desktop/cssOS-final/
    # 4. Drag them into App Store Connect's screenshot grid.

OUTPUT FORMAT
=============
Each output PNG is 1242×2688 (App Store 6.5" tier — Apple-accepted size).
Top 360px = dark band with green accent + bilingual headline overlay.
Bottom 2328px = your screenshot, scaled to fit the remaining space.
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ Pillow not installed. Run: pip3 install Pillow")
    sys.exit(1)

# ────────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────────

INPUT_DIR  = os.path.expanduser("~/Desktop/cssOS-raw")
OUTPUT_DIR = os.path.expanduser("~/Desktop/cssOS-final")

# Each tuple = (big white headline, smaller green subhead).
# Order matches the App Store display order (first 3 are the
# preview thumbnails — most impactful).
HEADLINES = [
    ("In 5 minutes.",            "AI music videos that look like this."),
    ("70 sages. 64 landmarks.",  "Your story — anyone, anywhere."),
    ("11 engines.",              "Transparent pricing per render."),
    ("Just say it.",             "Witness the miracle."),
    ("Anyone can be the star.",  "Shakespeare to Aunt Mary."),
    ("A real marketplace.",      "Real songs. Real value."),
    ("Just describe it.",        "We compose the whole MV."),
    ("Sages to scientists.",     "70+ historical figures, curated."),
    ("10 languages.",            "Across civilizations."),
    ("Pick your engines.",       "Swap on the fly."),
]

# cssOS palette
GREEN = (10, 245, 160)    # accent line + subhead text
DARK  = (8, 18, 14)       # band background
WHITE = (250, 250, 252)   # headline text

OUTPUT_W = 1242
OUTPUT_H = 2688
BAND_H   = 360

# ────────────────────────────────────────────────────────────────────
# Font loading — find a real font on macOS, fall back gracefully
# ────────────────────────────────────────────────────────────────────

FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/SFNSDisplay.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Avenir.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]
FONT_CANDIDATES_REGULAR = [
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Avenir.ttc",
    "/Library/Fonts/Arial.ttf",
]

def find_font(size, bold=False):
    paths = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REGULAR
    for path in paths:
        if os.path.exists(path):
            try:
                if path.endswith(".ttc"):
                    return ImageFont.truetype(path, size, index=0)
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    print(f"  ⚠️  Falling back to default font (size {size}) — install custom font for better look")
    return ImageFont.load_default()

# ────────────────────────────────────────────────────────────────────
# Rendering
# ────────────────────────────────────────────────────────────────────

def render(src_path, dst_path, headline, subhead):
    img = Image.open(src_path).convert("RGB")

    # Normalize input to 1242×2688 if it isn't already
    if (img.width, img.height) != (OUTPUT_W, OUTPUT_H):
        # Preserve aspect by fitting; pad with DARK if needed
        ratio_src = img.width / img.height
        ratio_dst = OUTPUT_W / OUTPUT_H
        if abs(ratio_src - ratio_dst) < 0.01:
            img = img.resize((OUTPUT_W, OUTPUT_H), Image.LANCZOS)
        else:
            # Letterbox if aspect differs
            new_h = OUTPUT_H
            new_w = int(new_h * ratio_src)
            if new_w > OUTPUT_W:
                new_w = OUTPUT_W
                new_h = int(new_w / ratio_src)
            resized = img.resize((new_w, new_h), Image.LANCZOS)
            tmp = Image.new("RGB", (OUTPUT_W, OUTPUT_H), DARK)
            tmp.paste(resized, ((OUTPUT_W - new_w) // 2, (OUTPUT_H - new_h) // 2))
            img = tmp

    # Scale screenshot down vertically to fit BELOW the band.
    inner_h = OUTPUT_H - BAND_H
    scaled = img.resize((OUTPUT_W, inner_h), Image.LANCZOS)

    # Compose final canvas
    canvas = Image.new("RGB", (OUTPUT_W, OUTPUT_H), DARK)
    canvas.paste(scaled, (0, BAND_H))

    draw = ImageDraw.Draw(canvas)

    # Band background (solid dark)
    draw.rectangle([0, 0, OUTPUT_W, BAND_H], fill=DARK)
    # Green accent line at bottom of band
    draw.rectangle([0, BAND_H - 6, OUTPUT_W, BAND_H], fill=GREEN)

    # Headline text — 110pt white bold, centered
    font_h = find_font(110, bold=True)
    font_s = find_font(54)

    # Auto-shrink headline if it overflows
    hw = draw.textlength(headline, font=font_h)
    if hw > OUTPUT_W - 80:
        scale = (OUTPUT_W - 80) / hw
        font_h = find_font(int(110 * scale), bold=True)
        hw = draw.textlength(headline, font=font_h)

    sw = draw.textlength(subhead, font=font_s)
    if sw > OUTPUT_W - 80:
        scale = (OUTPUT_W - 80) / sw
        font_s = find_font(int(54 * scale))
        sw = draw.textlength(subhead, font=font_s)

    # Vertical layout inside band
    bbox_h = draw.textbbox((0, 0), headline, font=font_h)
    headline_h = bbox_h[3] - bbox_h[1]

    bbox_s = draw.textbbox((0, 0), subhead, font=font_s)
    subhead_h = bbox_s[3] - bbox_s[1]

    total_h = headline_h + 36 + subhead_h
    start_y = (BAND_H - total_h) // 2 - 12  # nudge slightly up

    draw.text(((OUTPUT_W - hw) / 2, start_y), headline,
              fill=WHITE, font=font_h)
    draw.text(((OUTPUT_W - sw) / 2, start_y + headline_h + 36), subhead,
              fill=GREEN, font=font_s)

    canvas.save(dst_path, "PNG", optimize=True)
    print(f"  ✓ {os.path.basename(dst_path)}")

# ────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────

def main():
    if not os.path.isdir(INPUT_DIR):
        print(f"❌ Input folder not found: {INPUT_DIR}")
        print(f"")
        print(f"   Create it and drop your 10 PNGs there, then re-run:")
        print(f"     mkdir -p {INPUT_DIR}")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    files = sorted([
        f for f in os.listdir(INPUT_DIR)
        if f.lower().endswith(".png") and not f.startswith(".")
    ])

    if not files:
        print(f"❌ No PNGs found in {INPUT_DIR}")
        print(f"   AirDrop your 10 chosen screenshots to that folder.")
        sys.exit(1)

    print(f"📂 Found {len(files)} PNG(s) in {INPUT_DIR}")
    print(f"📂 Writing beautified output to {OUTPUT_DIR}")
    print()

    processed = 0
    for i, f in enumerate(files[:10]):
        if i >= len(HEADLINES):
            print(f"  (skipped — no headline configured for slot {i+1})")
            break
        src = os.path.join(INPUT_DIR, f)
        headline, subhead = HEADLINES[i]
        slug = (headline.lower()
                .replace(".", "")
                .replace(",", "")
                .replace(":", "")
                .replace(" ", "-")[:32])
        dst = os.path.join(OUTPUT_DIR, f"{i+1:02d}-{slug}.png")
        render(src, dst, headline, subhead)
        processed += 1

    print()
    print(f"✅ {processed} screenshots beautified.")
    print(f"📂 {OUTPUT_DIR}")
    print()
    print(f"NEXT: drag those PNGs into App Store Connect's screenshot grid")
    print(f"      (cssOS app → Version 1.0 → Previews and Screenshots → iPhone 6.5\")")

    # Auto-open the output folder for convenience
    if sys.platform == "darwin":
        os.system(f'open "{OUTPUT_DIR}"')

if __name__ == "__main__":
    main()
