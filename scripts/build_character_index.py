import csv
import json
import os


META_FILE = "data/meta/characters.csv"
CLIPS_ROOT = "data/clips"
OUT_FILE = "data/meta/character_index.json"


def main():
    index = {}

    if not os.path.isfile(META_FILE):
        raise FileNotFoundError(f"missing metadata file: {META_FILE}")

    with open(META_FILE, "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            character_id = row["character_id"].strip()
            video_file = row["video_file"].strip()
            base = os.path.splitext(video_file)[0]
            clip_dir = os.path.join(CLIPS_ROOT, base)

            if not character_id or not os.path.isdir(clip_dir):
                continue

            clips = sorted(
                os.path.join(clip_dir, name)
                for name in os.listdir(clip_dir)
                if name.endswith(".mp4")
            )
            index.setdefault(character_id, []).extend(clips)

    with open(OUT_FILE, "w", encoding="utf-8") as handle:
        json.dump(index, handle, indent=2, ensure_ascii=False)

    print(f"saved: {OUT_FILE}")
    print(f"characters: {len(index)}")
    for character_id, clips in sorted(index.items()):
        print(character_id, len(clips))


if __name__ == "__main__":
    main()
