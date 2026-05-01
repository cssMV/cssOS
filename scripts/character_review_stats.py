import csv
import os
from collections import Counter, defaultdict


INPUT = "data/meta/character_review.csv"
OUTPUT = "data/meta/character_review_stats.csv"


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing review file: {INPUT}")

    per_character = defaultdict(Counter)

    with open(INPUT, "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            character_id = (row.get("character_id") or "").strip()
            status = (row.get("status") or "unsure").strip().lower()
            if not character_id:
                continue
            per_character[character_id]["total"] += 1
            per_character[character_id][status] += 1

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "character_id",
                "total",
                "keep",
                "drop",
                "unsure",
                "keep_ratio",
                "drop_ratio",
            ],
        )
        writer.writeheader()

        for character_id in sorted(per_character):
            stats = per_character[character_id]
            total = stats["total"]
            keep = stats["keep"]
            drop = stats["drop"]
            unsure = stats["unsure"]
            writer.writerow(
                {
                    "character_id": character_id,
                    "total": total,
                    "keep": keep,
                    "drop": drop,
                    "unsure": unsure,
                    "keep_ratio": f"{(keep / total) if total else 0:.4f}",
                    "drop_ratio": f"{(drop / total) if total else 0:.4f}",
                }
            )

    print(f"saved: {OUTPUT}")
    for character_id in sorted(per_character):
        stats = per_character[character_id]
        total = stats["total"]
        print(
            character_id,
            f"total={total}",
            f"keep={stats['keep']}",
            f"drop={stats['drop']}",
            f"unsure={stats['unsure']}",
        )


if __name__ == "__main__":
    main()
