#!/usr/bin/env python3
import csv
from pathlib import Path


CSV_PATH = Path("data/meta/day5_replacement_triage/char002_replacement_triage.csv")

KEEP_MAP = {
    "015": ("keep", "dark_hotel_closeup", "strongest replacement for audit/interrogation mood"),
    "028": ("keep", "interrogation_dialogue", "usable dramatic dialogue shot despite film-source baggage"),
    "033": ("keep", "black_stage_monologue", "good black-stage silhouette for abstract identity beat"),
    "039": ("keep", "black_bg_monologue", "usable black background performance backup"),
    "047": ("keep", "half_lit_dark_closeup", "strong moody half-face close-up closest to westworld tension"),
    "048": ("keep", "blue_side_profile", "usable profile shot for interior-doubt replacement"),
}

PENDING_MAP = {}

DROP_DEFAULT_DECISION = "not_selected_manual_day5"
DROP_DEFAULT_NOTE = "manual_day5_fine_triage"


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    for row in rows:
        sample_index = row["sample_index"]
        if sample_index in KEEP_MAP:
            status, decision, notes = KEEP_MAP[sample_index]
            row["status"] = status
            row["decision"] = decision
            row["notes"] = notes
        elif sample_index in PENDING_MAP:
            status, decision, notes = PENDING_MAP[sample_index]
            row["status"] = status
            row["decision"] = decision
            row["notes"] = notes
        else:
            row["status"] = "drop"
            if not row["decision"]:
                row["decision"] = DROP_DEFAULT_DECISION
            row["notes"] = DROP_DEFAULT_NOTE

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    keep_count = sum(1 for row in rows if row["status"] == "keep")
    drop_count = sum(1 for row in rows if row["status"] == "drop")
    pending_count = sum(1 for row in rows if row["status"] == "pending")
    print(f"rows={len(rows)}")
    print(f"keep={keep_count}")
    print(f"drop={drop_count}")
    print(f"pending={pending_count}")


if __name__ == "__main__":
    main()
