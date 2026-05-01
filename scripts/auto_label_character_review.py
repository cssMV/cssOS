import csv
import os


INPUT = "data/meta/character_review.csv"
OUTPUT = "data/meta/character_review.csv"

DROP_KEYWORDS = [
    "fan-made",
    "sasquatch",
    "hot actress",
    "lips and face closeup",
    "lips and face",
    "back of eyes close up check",
    "eye",
    "viral",
]

KEEP_KEYWORDS = [
    "interview",
    "talk",
    "talking",
    "portrait",
    "profile",
    "close up",
    "close-up",
    "monologue",
    "reaction",
]

KEEP_SOURCE_PREFIXES = [
    "1985年周海媚選美寶貴鏡頭",
    "2004年当外媒稍显挑衅地问道64事件",
    "5個他拍上鏡絕學",
]


def decide(row):
    frame_path = (row.get("frame_path") or "").lower()

    for keyword in DROP_KEYWORDS:
        if keyword in frame_path:
            return "drop", f"auto_drop:{keyword}"

    for prefix in KEEP_SOURCE_PREFIXES:
        if prefix.lower() in frame_path:
            return "keep", f"auto_keep:{prefix}"

    for keyword in KEEP_KEYWORDS:
        if keyword in frame_path:
            return "keep", f"auto_keep:{keyword}"

    return "drop", "auto_drop:unvetted_source"


def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"missing review file: {INPUT}")

    with open(INPUT, "r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    for row in rows:
        status, note = decide(row)
        row["status"] = status
        existing = (row.get("notes") or "").strip()
        row["notes"] = note if not existing else f"{existing};{note}"

    with open(OUTPUT, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["character_id", "frame_path", "status", "notes"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"saved: {OUTPUT}")


if __name__ == "__main__":
    main()
