#!/usr/bin/env python3
import csv
from collections import Counter, defaultdict
from pathlib import Path


INPUT = Path("data/meta/day3_triage/day3_character_triage.csv")
OUTPUT = Path("data/meta/day3_triage/day3_character_triage_stats.csv")
VALID_STATUSES = ("keep", "drop", "pending")


def main() -> None:
    if not INPUT.is_file():
        raise FileNotFoundError(f"missing triage file: {INPUT}")

    per_character: dict[str, Counter[str]] = defaultdict(Counter)

    with INPUT.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            character_id = (row.get("character_id") or "").strip()
            if not character_id:
                continue
            status = (row.get("status") or "pending").strip().lower()
            if status not in VALID_STATUSES:
                status = "pending"
            per_character[character_id]["total"] += 1
            per_character[character_id][status] += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "character_id",
                "total",
                "keep",
                "drop",
                "pending",
                "reviewed",
                "remaining",
                "review_progress",
                "keep_ratio_total",
                "drop_ratio_total",
                "keep_ratio_reviewed",
            ],
        )
        writer.writeheader()

        for character_id in sorted(per_character):
            stats = per_character[character_id]
            total = stats["total"]
            keep = stats["keep"]
            drop = stats["drop"]
            pending = stats["pending"]
            reviewed = keep + drop
            remaining = pending
            writer.writerow(
                {
                    "character_id": character_id,
                    "total": total,
                    "keep": keep,
                    "drop": drop,
                    "pending": pending,
                    "reviewed": reviewed,
                    "remaining": remaining,
                    "review_progress": f"{reviewed}/{total}",
                    "keep_ratio_total": f"{(keep / total) if total else 0:.4f}",
                    "drop_ratio_total": f"{(drop / total) if total else 0:.4f}",
                    "keep_ratio_reviewed": f"{(keep / reviewed) if reviewed else 0:.4f}",
                }
            )

    print(f"saved: {OUTPUT}")
    for character_id in sorted(per_character):
        stats = per_character[character_id]
        total = stats["total"]
        keep = stats["keep"]
        drop = stats["drop"]
        pending = stats["pending"]
        reviewed = keep + drop
        remaining = pending
        keep_ratio_reviewed = (keep / reviewed) if reviewed else 0.0
        print(
            character_id,
            f"progress={reviewed}/{total}",
            f"remaining={remaining}",
            f"total={total}",
            f"keep={keep}",
            f"drop={drop}",
            f"pending={pending}",
            f"keep_ratio_reviewed={keep_ratio_reviewed:.4f}",
        )


if __name__ == "__main__":
    main()
