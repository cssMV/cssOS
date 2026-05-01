#!/usr/bin/env python3
import csv
import re
from pathlib import Path


CSV_PATH = Path("data/meta/day5_replacement_triage/char002_replacement_triage.csv")

DROP_PATTERNS = [
    (r"(?i)\b(news|bbc|ktla|tvbs|live shot|summit|robbery suspect|kidnapper)\b", "news_or_live_clip"),
    (r"(?i)\b(game|gaming|手游|攻略|onmyoji|阴阳师|皮肤实战试玩)\b", "game_or_animation"),
    (r"(?i)\b(twice|superband|演出|花絮|同學來了|studentscoming)\b", "variety_or_music_show"),
    (r"(?i)\b(tutorial|installation process|install|how to|prompt)\b", "tutorial_or_process"),
    (r"(?i)\b(vlog|podcast|asmr|weatherman|morning show)\b", "talk_show_or_vlog"),
    (r"(?i)\b(female|actress|jennifer aniston|lala|子瑜)\b", "wrong_identity_female"),
    (r"(?i)\b(outdoor|street|seacoast|office buildings|sea and cloudy sky|sunset|hat)\b", "wrong_setting_outdoor"),
    (r"(?i)\b(smoking|cigarette|doctor|medical worker|cargo van|wood slat wall|acoustic panels)\b", "wrong_action_or_topic"),
    (r"(?i)\b(compilation|mix|混剪)\b", "compilation"),
]

KEEP_HINTS = [
    r"(?i)\b(close-up portrait of a crying man)\b",
    r"(?i)\b(close-up portrait of attractive mature man with serious expression looking at camera)\b",
    r"(?i)\b(closeup thoughtful man face looking in dark hotel room portrait)\b",
    r"(?i)\b(man in the shadow)\b",
    r"(?i)\b(thinking man isolated on black background)\b",
    r"(?i)\b(man looks on a dark background)\b",
    r"(?i)\b(close up portrait of young asian teenager man)\b",
]


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    drop_count = 0
    touched = 0

    for row in rows:
        if row["status"] != "pending":
            continue
        name = row["source_name"]
        if any(re.search(pattern, name) for pattern in KEEP_HINTS):
            continue
        for pattern, decision in DROP_PATTERNS:
            if re.search(pattern, name):
                row["status"] = "drop"
                row["decision"] = decision
                row["notes"] = "auto_day5_title_filter"
                drop_count += 1
                touched += 1
                break

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    pending_count = sum(1 for row in rows if row["status"] == "pending")
    print(f"rows={len(rows)}")
    print(f"auto_drop={drop_count}")
    print(f"pending={pending_count}")
    print(f"touched={touched}")


if __name__ == "__main__":
    main()
