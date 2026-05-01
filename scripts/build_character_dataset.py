import json
import os
import shutil


INPUT = "data/meta/character_clusters.json"
OUT_DIR = "data/characters"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(INPUT, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    for char_id, frames in data.items():
        char_dir = os.path.join(OUT_DIR, char_id)
        os.makedirs(char_dir, exist_ok=True)

        for index, frame in enumerate(frames):
            dst = os.path.join(char_dir, f"{index:05d}.png")
            try:
                shutil.copy(frame, dst)
            except OSError:
                pass

    print("character dataset ready")


if __name__ == "__main__":
    main()
