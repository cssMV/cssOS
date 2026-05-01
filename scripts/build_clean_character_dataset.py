import csv
import os
import shutil
from collections import defaultdict


INPUT = "data/meta/character_review.csv"
OUTPUT_DIR = "data/characters_clean"
VALID_STATUS = {"keep"}


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing review file: {INPUT}")

    grouped = defaultdict(list)

    with open(INPUT, "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            status = (row.get("status") or "").strip().lower()
            character_id = (row.get("character_id") or "").strip()
            frame_path = (row.get("frame_path") or "").strip()

            if status not in VALID_STATUS:
                continue
            if not character_id or not frame_path or not os.path.isfile(frame_path):
                continue

            grouped[character_id].append(frame_path)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = 0
    for character_id in sorted(grouped):
        char_dir = os.path.join(OUTPUT_DIR, character_id)
        os.makedirs(char_dir, exist_ok=True)

        for index, frame_path in enumerate(sorted(grouped[character_id])):
            dst = os.path.join(char_dir, f"{index:05d}.png")
            shutil.copy(frame_path, dst)
            total += 1

    print(f"saved: {OUTPUT_DIR}")
    print(f"characters: {len(grouped)}")
    print(f"frames: {total}")
    for character_id in sorted(grouped):
        print(character_id, len(grouped[character_id]))


if __name__ == "__main__":
    main()
