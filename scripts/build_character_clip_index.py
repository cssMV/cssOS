import csv
import json
import os
from collections import defaultdict


INPUT = "data/meta/character_clusters.json"
OUTPUT = "data/meta/character_clip_index.csv"


def frame_to_clip(frame_path: str) -> str:
    directory = os.path.dirname(frame_path)
    return os.path.basename(directory)


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing cluster file: {INPUT}")

    with open(INPUT, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    grouped = defaultdict(lambda: defaultdict(list))
    for character_id, frames in data.items():
        for frame_path in frames:
            clip_id = frame_to_clip(frame_path)
            grouped[character_id][clip_id].append(frame_path)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["character_id", "clip_id", "frame_count", "sample_frame"],
        )
        writer.writeheader()
        for character_id in sorted(grouped):
            items = sorted(
                grouped[character_id].items(),
                key=lambda item: (-len(item[1]), item[0]),
            )
            for clip_id, frames in items:
                writer.writerow(
                    {
                        "character_id": character_id,
                        "clip_id": clip_id,
                        "frame_count": len(frames),
                        "sample_frame": frames[0],
                    }
                )

    print(f"saved: {OUTPUT}")


if __name__ == "__main__":
    main()
