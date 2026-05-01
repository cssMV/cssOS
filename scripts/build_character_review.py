import csv
import json
import os


INPUT = "data/meta/character_clusters.json"
OUTPUT = "data/meta/character_review.csv"


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing cluster file: {INPUT}")

    with open(INPUT, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    rows = []
    for character_id in sorted(data):
        for frame_path in sorted(data[character_id]):
            rows.append(
                {
                    "character_id": character_id,
                    "frame_path": frame_path,
                    "status": "unsure",
                    "notes": "",
                }
            )

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["character_id", "frame_path", "status", "notes"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"saved: {OUTPUT}")
    print(f"rows: {len(rows)}")


if __name__ == "__main__":
    main()
