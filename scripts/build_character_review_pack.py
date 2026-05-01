import json
import math
import os

from PIL import Image, ImageOps, ImageDraw


INPUT = "data/meta/character_clusters.json"
OUT_DIR = "data/meta/review_packs"
SAMPLES_PER_CHARACTER = 25
THUMB_SIZE = (128, 128)
GRID_COLUMNS = 5


def pick_samples(frames, limit):
    if len(frames) <= limit:
        return frames
    step = max(1, len(frames) // limit)
    picked = frames[::step][:limit]
    return picked


def draw_sheet(character_id, frames):
    samples = pick_samples(sorted(frames), SAMPLES_PER_CHARACTER)
    rows = math.ceil(len(samples) / GRID_COLUMNS)
    width = GRID_COLUMNS * THUMB_SIZE[0]
    height = rows * (THUMB_SIZE[1] + 18)
    sheet = Image.new("RGB", (width, height), color=(18, 18, 18))
    draw = ImageDraw.Draw(sheet)

    for index, frame_path in enumerate(samples):
        row = index // GRID_COLUMNS
        col = index % GRID_COLUMNS
        x = col * THUMB_SIZE[0]
        y = row * (THUMB_SIZE[1] + 18)

        try:
            image = Image.open(frame_path).convert("RGB")
            image = ImageOps.fit(image, THUMB_SIZE)
            sheet.paste(image, (x, y))
            draw.text((x + 4, y + THUMB_SIZE[1] + 2), str(index), fill=(255, 255, 255))
        except OSError:
            draw.rectangle([x, y, x + THUMB_SIZE[0], y + THUMB_SIZE[1]], outline=(255, 0, 0))
            draw.text((x + 4, y + 4), "missing", fill=(255, 80, 80))

    return sheet


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing cluster file: {INPUT}")

    with open(INPUT, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    os.makedirs(OUT_DIR, exist_ok=True)
    for character_id in sorted(data):
        sheet = draw_sheet(character_id, data[character_id])
        out_path = os.path.join(OUT_DIR, f"{character_id}.jpg")
        sheet.save(out_path, quality=90)
        print(f"saved: {out_path}")


if __name__ == "__main__":
    main()
